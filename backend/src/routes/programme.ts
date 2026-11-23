import { z } from 'zod';
import { db } from '../db';
import { assertPartnerAccess, auth, ownPartnerId, role, type AuthUser } from '../auth';
import { badRequest, conflict, notFound } from '../lib/http';
import { Router, type Ctx } from '../lib/router';
import { audit } from '../services/audit';
import { settings } from '../services/settings';

/** Partner network, benefits and rewards. */
export const programmeRoutes = new Router();

async function pointsFor(partnerId: number) {
  const row = await db.one(
    `SELECT COALESCE(SUM(points) FILTER (WHERE status = 'Approved'), 0)::int AS balance,
            COALESCE(SUM(-points) FILTER (WHERE status = 'Pending' AND kind = 'redeem'), 0)::int AS reserved
       FROM points_entries WHERE partner_id = $1`,
    [partnerId],
  );
  return { balance: row.balance as number, available: (row.balance - row.reserved) as number };
}

const partnerIdParam = (ctx: Ctx, user: AuthUser) => (ctx.params.id === 'me' ? ownPartnerId(user) : ctx.param('id'));

// ---------- Partners ----------

programmeRoutes.get('/partners', auth, role('REVIEWER'), () =>
  db.many(
    `SELECT p.*,
            COALESCE((SELECT SUM(points) FROM points_entries e WHERE e.partner_id = p.id AND e.status = 'Approved'), 0)::int AS points,
            (SELECT COUNT(*) FROM benefit_requests r WHERE r.partner_id = p.id AND r.status = 'Pending')::int AS pending_benefits
       FROM partners p ORDER BY p.code`,
  ),
);

programmeRoutes.get('/partners/:id', auth, async (ctx) => {
  const id = partnerIdParam(ctx, ctx.me);
  const partner = await db.maybe('SELECT * FROM partners WHERE id = $1', [id]);
  if (!partner) throw notFound('Partner not found.');
  assertPartnerAccess(ctx.me, partner.id);
  return { ...partner, points: (await pointsFor(partner.id)).balance };
});

const ProfileBody = z.object({
  name: z.string().trim().min(1).max(80),
  contact: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  focus: z.enum(['ThinkPad workplace', 'ThinkSystem infrastructure', 'ThinkStation creators']),
  goal: z.string().trim().min(1).max(500),
});

programmeRoutes.put('/partners/:id', auth, async (ctx) => {
  const id = partnerIdParam(ctx, ctx.me);
  assertPartnerAccess(ctx.me, id);
  const b = ProfileBody.parse(await ctx.json());
  const n = await db.run('UPDATE partners SET name=$1, contact=$2, email=$3, focus=$4, goal=$5 WHERE id=$6', [b.name, b.contact, b.email, b.focus, b.goal, id]);
  if (!n) throw notFound('Partner not found.');
  await audit({ userId: ctx.me.id, entity: 'partner', entityId: id, action: 'Profile updated' });
  return { ok: true };
});

// ---------- Benefits ----------

programmeRoutes.get('/benefits', auth, async (ctx) => {
  const user = ctx.me;
  const partner = user.partnerId ? await db.maybe('SELECT segment FROM partners WHERE id = $1', [user.partnerId]) : undefined;
  const items = await db.many('SELECT * FROM benefit_items ORDER BY id');
  const requests = await db.many(
    `SELECT r.id, b.name AS benefit, p.name AS partner, r.note, r.status, r.decision_note, r.created_at
       FROM benefit_requests r JOIN benefit_items b ON b.id = r.benefit_id JOIN partners p ON p.id = r.partner_id
      ${user.role === 'PARTNER' ? 'WHERE r.partner_id = $1' : ''}
      ORDER BY r.created_at DESC`,
    user.role === 'PARTNER' ? [user.partnerId] : [],
  );
  return { items: items.map((b) => ({ ...b, eligible: !partner || b.segment === 'All' || b.segment === partner.segment })), requests };
});

programmeRoutes.post('/benefits/:id/request', auth, role('PARTNER'), async (ctx) => {
  const partnerId = ownPartnerId(ctx.me);
  const { note } = z.object({ note: z.string().trim().min(1, 'Tell us what you need.').max(500) }).parse(await ctx.json());
  const benefit = await db.maybe('SELECT * FROM benefit_items WHERE id = $1', [ctx.param('id')]);
  if (!benefit) throw notFound('Benefit not found.');
  const partner = await db.one('SELECT segment FROM partners WHERE id = $1', [partnerId]);
  if (benefit.segment !== 'All' && benefit.segment !== partner.segment) throw badRequest(`This benefit is for ${benefit.segment} partners.`);
  if (await db.maybe(`SELECT 1 FROM benefit_requests WHERE partner_id=$1 AND benefit_id=$2 AND status='Pending'`, [partnerId, benefit.id]))
    throw conflict('You already have a pending request for this benefit.');
  const saved = await db.one('INSERT INTO benefit_requests (partner_id, benefit_id, note) VALUES ($1,$2,$3) RETURNING id', [partnerId, benefit.id, note]);
  await audit({ userId: ctx.me.id, entity: 'benefit', entityId: saved.id, action: 'Requested', toStatus: 'Pending' });
  ctx.status = 201;
  return saved;
});

const Decision = z.object({ decision: z.enum(['Approved', 'Rejected']), note: z.string().trim().max(500).default('') });

programmeRoutes.post('/benefits/requests/:id/decision', auth, role('REVIEWER'), async (ctx) => {
  const { decision, note } = Decision.parse(await ctx.json());
  const r = await db.maybe('SELECT id, status FROM benefit_requests WHERE id = $1', [ctx.param('id')]);
  if (!r) throw notFound();
  if (r.status !== 'Pending') throw conflict('Only pending requests can be decided.');
  if (decision === 'Rejected' && !note) throw badRequest('Give the partner a reason.');
  await db.run('UPDATE benefit_requests SET status=$1, decision_note=$2 WHERE id=$3', [decision, note || null, r.id]);
  await audit({ userId: ctx.me.id, entity: 'benefit', entityId: r.id, action: `Decision: ${decision}`, fromStatus: 'Pending', toStatus: decision, note });
  return { ok: true };
});

// ---------- Rewards ----------

programmeRoutes.get('/rewards', auth, async (ctx) => {
  const items = await db.many('SELECT * FROM reward_items ORDER BY cost');
  const pointsPerActivity = settings().pointsPerActivity;
  if (ctx.me.role !== 'PARTNER') return { items, pointsPerActivity, balance: null, available: null, entries: [] };
  const { balance, available } = await pointsFor(ctx.me.partnerId!);
  const entries = await db.many(
    'SELECT id, kind, points, reason, status, decision_note, created_at FROM points_entries WHERE partner_id = $1 ORDER BY created_at DESC, id DESC',
    [ctx.me.partnerId],
  );
  return { items, pointsPerActivity, balance, available, entries };
});

programmeRoutes.post('/rewards/earn', auth, role('PARTNER'), async (ctx) => {
  const partnerId = ownPartnerId(ctx.me);
  const b = z
    .object({ activity: z.string().trim().min(1, 'Name the activity.').max(120), evidence: z.string().trim().min(1, 'Describe the evidence.').max(500) })
    .parse(await ctx.json());
  const saved = await db.one(`INSERT INTO points_entries (partner_id, kind, points, reason, evidence) VALUES ($1, 'earn', $2, $3, $4) RETURNING id`, [
    partnerId,
    settings().pointsPerActivity,
    b.activity,
    b.evidence,
  ]);
  await audit({ userId: ctx.me.id, entity: 'points', entityId: saved.id, action: 'Earn submitted', toStatus: 'Pending' });
  ctx.status = 201;
  return saved;
});

programmeRoutes.post('/rewards/:id/redeem', auth, role('PARTNER'), async (ctx) => {
  const partnerId = ownPartnerId(ctx.me);
  const reward = await db.maybe('SELECT * FROM reward_items WHERE id = $1', [ctx.param('id')]);
  if (!reward) throw notFound('Reward not found.');
  const { available } = await pointsFor(partnerId);
  if (available < reward.cost) throw badRequest(`Not enough points: ${available} available, ${reward.cost} needed.`);
  const saved = await db.one(`INSERT INTO points_entries (partner_id, kind, points, reason, reward_id) VALUES ($1, 'redeem', $2, $3, $4) RETURNING id`, [
    partnerId,
    -reward.cost,
    `Redeem: ${reward.name}`,
    reward.id,
  ]);
  await audit({ userId: ctx.me.id, entity: 'points', entityId: saved.id, action: 'Redemption requested', toStatus: 'Pending' });
  ctx.status = 201;
  return saved;
});

programmeRoutes.post('/rewards/entries/:id/decision', auth, role('REVIEWER'), async (ctx) => {
  const { decision, note } = Decision.parse(await ctx.json());
  const e = await db.maybe('SELECT * FROM points_entries WHERE id = $1', [ctx.param('id')]);
  if (!e) throw notFound();
  if (e.status !== 'Pending') throw conflict('Only pending entries can be decided.');
  if (decision === 'Rejected' && !note) throw badRequest('Give the partner a reason.');
  if (decision === 'Approved' && e.kind === 'redeem' && (await pointsFor(e.partnerId)).balance + e.points < 0) throw conflict('The partner no longer has enough points.');
  await db.run('UPDATE points_entries SET status=$1, decision_note=$2 WHERE id=$3', [decision, note || null, e.id]);
  await audit({ userId: ctx.me.id, entity: 'points', entityId: e.id, action: `Decision: ${decision}`, fromStatus: 'Pending', toStatus: decision, note });
  return { ok: true };
});
