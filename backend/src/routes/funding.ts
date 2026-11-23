import { z } from 'zod';
import { db, type Executor } from '../db';
import { assertPartnerAccess, auth, ownPartnerId, role, type AuthUser } from '../auth';
import { badRequest, conflict, forbidden, notFound } from '../lib/http';
import { Router } from '../lib/router';
import { audit, history } from '../services/audit';
import { partnerBudget } from '../services/budget';
import { CAMPAIGN_TYPES, fundingProblem, isLocked } from '../services/rules';
import { loadFunding, publicFunding } from '../services/serialize';

export const fundingRoutes = new Router();

/** One funding request with everything attached; checks the user may see it. */
export async function getFunding(id: number, user: AuthUser) {
  if (!Number.isInteger(id)) throw notFound();
  const [f] = await loadFunding('f.id = $1', [id]);
  if (!f) throw notFound('Funding request not found.');
  assertPartnerAccess(user, f.partnerId);
  if (user.role !== 'PARTNER' && f.status === 'Draft') throw notFound('Funding request not found.');
  return f;
}

export async function nextCode(tx: Executor, prefix: 'MDF' | 'CLM') {
  const table = prefix === 'MDF' ? 'funding_requests' : 'claims';
  const row = await tx.one(`SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '-', 2) AS INTEGER)), 0) + 1 AS next FROM ${table}`);
  return `${prefix}-${String(row.next).padStart(3, '0')}`;
}

const FundingBody = z.object({
  title: z.string().trim().min(1, 'Activity name is required.').max(100),
  kitId: z.number().int().nullable().optional(),
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/, 'Choose a quarter.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.'),
  type: z.enum(CAMPAIGN_TYPES),
  objective: z.string().trim().min(1, 'Objective is required.').max(1000),
  eligibleCost: z.number().positive().max(1_000_000),
  amount: z.number().positive(),
  submit: z.boolean().default(false),
  attest: z.boolean().default(false),
});

const Decision = z.object({
  decision: z.enum(['Approved', 'Changes requested', 'Rejected']),
  note: z.string().trim().max(1000).default(''),
});

// List: partners see their own; reviewers and admins see all except private drafts.
fundingRoutes.get('/', auth, async (ctx) => {
  const user = ctx.me;
  const quarter = ctx.query.get('quarter');
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (user.role === 'PARTNER') {
    params.push(user.partnerId);
    conditions.push(`f.partner_id = $${params.length}`);
  } else {
    conditions.push(`f.status <> 'Draft'`);
  }
  if (quarter && quarter !== 'all') {
    params.push(quarter);
    conditions.push(`f.quarter = $${params.length}`);
  }
  const [items, budget] = await Promise.all([
    loadFunding(conditions.join(' AND '), params),
    user.role === 'PARTNER' ? partnerBudget(user.partnerId!) : null,
  ]);
  return { items: items.map(publicFunding), budget };
});

fundingRoutes.get('/budget', auth, async (ctx) => partnerBudget(ownPartnerId(ctx.me)));

fundingRoutes.get('/:id', auth, async (ctx) => {
  const f = await getFunding(ctx.param('id'), ctx.me);
  const [budget, hist] = await Promise.all([partnerBudget(f.partnerId, f.id), history('funding', f.id)]);
  return { item: publicFunding(f), budget, history: hist };
});

async function saveFunding(body: z.infer<typeof FundingBody>, partnerId: number, userId: number, existingId?: number) {
  const budget = await partnerBudget(partnerId, existingId);
  const problem = fundingProblem(body, budget.available);
  if (problem) throw badRequest(problem);
  if (body.submit && !body.attest) throw badRequest('Confirm that funding approval will be obtained before committing spend.');
  if (body.kitId && !(await db.maybe('SELECT id FROM campaign_kits WHERE id = $1', [body.kitId]))) throw badRequest('Unknown campaign kit.');
  const values = [body.title, body.kitId ?? null, body.quarter, body.date, body.type, body.objective, body.eligibleCost, body.amount];
  return db.tx(async (tx) => {
    let id = existingId;
    if (id) {
      await tx.run(
        `UPDATE funding_requests SET title=$1, kit_id=$2, quarter=$3, date=$4, type=$5, objective=$6, eligible_cost=$7, amount=$8, updated_at=now() WHERE id=$9`,
        [...values, id],
      );
    } else {
      const code = await nextCode(tx, 'MDF');
      id = (
        await tx.one(
          `INSERT INTO funding_requests (title, kit_id, quarter, date, type, objective, eligible_cost, amount, partner_id, code)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [...values, partnerId, code],
        )
      ).id as number;
    }
    if (body.submit) {
      await tx.run(
        `UPDATE funding_requests SET status='Submitted', submitted_by=$1, submitted_at=now(), feedback=NULL WHERE id=$2`,
        [userId, id],
      );
    }
    return id;
  });
}

fundingRoutes.post('/', auth, role('PARTNER'), async (ctx) => {
  const user = ctx.me;
  const body = FundingBody.parse(await ctx.json());
  const id = await saveFunding(body, ownPartnerId(user), user.id);
  await audit({ userId: user.id, entity: 'funding', entityId: id, action: 'Created', toStatus: 'Draft' });
  if (body.submit) await audit({ userId: user.id, entity: 'funding', entityId: id, action: 'Submitted for review', fromStatus: 'Draft', toStatus: 'Submitted' });
  ctx.status = 201;
  return publicFunding(await getFunding(id, user));
});

fundingRoutes.put('/:id', auth, role('PARTNER'), async (ctx) => {
  const user = ctx.me;
  const f = await getFunding(ctx.param('id'), user);
  if (isLocked(f.status)) throw conflict(`This request is ${f.status.toLowerCase()} and can no longer be edited.`);
  const body = FundingBody.parse(await ctx.json());
  await saveFunding(body, f.partnerId, user.id, f.id);
  await audit({
    userId: user.id,
    entity: 'funding',
    entityId: f.id,
    action: body.submit ? 'Submitted for review' : 'Draft saved',
    fromStatus: f.status,
    toStatus: body.submit ? 'Submitted' : f.status,
  });
  return publicFunding(await getFunding(f.id, user));
});

fundingRoutes.delete('/:id', auth, role('PARTNER'), async (ctx) => {
  const f = await getFunding(ctx.param('id'), ctx.me);
  if (f.status !== 'Draft') throw conflict('Only drafts can be deleted.');
  await db.run('DELETE FROM funding_requests WHERE id = $1', [f.id]);
  return { ok: true };
});

fundingRoutes.post('/:id/decision', auth, role('REVIEWER'), async (ctx) => {
  const user = ctx.me;
  const f = await getFunding(ctx.param('id'), user);
  const { decision, note } = Decision.parse(await ctx.json());
  if (f.status !== 'Submitted') throw conflict('Only submitted requests can be reviewed.');
  if (f.submittedBy === user.id) throw forbidden('You cannot decide a request you submitted.');
  if (decision !== 'Approved' && !note) throw badRequest('Give the partner a reason.');
  if (decision === 'Approved' && f.amount > (await partnerBudget(f.partnerId, f.id)).available) throw conflict('Not enough budget left to approve this request.');
  await db.run('UPDATE funding_requests SET status=$1, feedback=$2, decided_by=$3, decided_at=now(), updated_at=now() WHERE id=$4', [decision, note || null, user.id, f.id]);
  await audit({ userId: user.id, entity: 'funding', entityId: f.id, action: `Decision: ${decision}`, fromStatus: f.status, toStatus: decision, note });
  return publicFunding(await getFunding(f.id, user));
});

// Start the campaign linked to an approved request. Creates its draft claim too.
fundingRoutes.post('/:id/start', auth, role('PARTNER'), async (ctx) => {
  const user = ctx.me;
  const f = await getFunding(ctx.param('id'), user);
  if (f.status !== 'Approved') throw conflict('Funding must be approved before the campaign can start.');
  if (!f.campaign) {
    await db.tx(async (tx) => {
      const campaign = await tx.one('INSERT INTO campaigns (funding_id) VALUES ($1) RETURNING id', [f.id]);
      await tx.run('INSERT INTO claims (campaign_id, code) VALUES ($1, $2)', [campaign.id, await nextCode(tx, 'CLM')]);
    });
    await audit({ userId: user.id, entity: 'funding', entityId: f.id, action: 'Campaign started' });
  }
  return publicFunding(await getFunding(f.id, user));
});
