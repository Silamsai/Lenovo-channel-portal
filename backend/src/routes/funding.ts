import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { assertPartnerAccess, ownPartnerId, requireRole, type AuthUser } from '../middleware/auth';
import { badRequest, conflict, forbidden, notFound } from '../middleware/errors';
import { audit, history } from '../services/audit';
import { partnerBudget } from '../services/budget';
import { CAMPAIGN_TYPES, fundingProblem, isLocked } from '../services/rules';
import { fundingInclude, serializeFunding } from '../services/serialize';

export const fundingRouter = Router();

export async function loadFunding(id: number, user: AuthUser) {
  if (!Number.isInteger(id)) throw notFound();
  const f = await prisma.fundingRequest.findUnique({ where: { id }, include: fundingInclude });
  if (!f) throw notFound('Funding request not found.');
  assertPartnerAccess(user, f.partnerId);
  return f;
}

async function nextCode(prefix: 'MDF' | 'CLM') {
  const rows =
    prefix === 'MDF'
      ? await prisma.fundingRequest.findMany({ select: { code: true } })
      : await prisma.claim.findMany({ select: { code: true } });
  const max = rows.reduce((n, r) => Math.max(n, Number(r.code.split('-')[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
export { nextCode };

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

// List: partners see their own; reviewers see all (optionally filtered).
fundingRouter.get('/', async (req, res) => {
  const user = req.user!;
  const quarter = typeof req.query.quarter === 'string' && req.query.quarter !== 'all' ? req.query.quarter : undefined;
  const rows = await prisma.fundingRequest.findMany({
    where: {
      ...(user.role === 'PARTNER' ? { partnerId: user.partnerId! } : {}),
      ...(quarter ? { quarter } : {}),
      // Reviewers do not see partners' private drafts.
      ...(user.role === 'REVIEWER' ? { status: { not: 'Draft' } } : {}),
    },
    include: fundingInclude,
    orderBy: [{ date: 'desc' }],
  });
  const budget = user.role === 'PARTNER' ? await partnerBudget(user.partnerId!) : null;
  res.json({ items: rows.map(serializeFunding), budget });
});

fundingRouter.get('/budget', async (req, res) => {
  res.json(await partnerBudget(ownPartnerId(req.user!)));
});

fundingRouter.get('/:id', async (req, res) => {
  const f = await loadFunding(Number(req.params.id), req.user!);
  if (req.user!.role === 'REVIEWER' && f.status === 'Draft') throw notFound('Funding request not found.');
  res.json({
    item: serializeFunding(f),
    budget: await partnerBudget(f.partnerId, f.id),
    history: await history('funding', f.id),
  });
});

async function saveFunding(body: z.infer<typeof FundingBody>, partnerId: number, userId: number, existingId?: number) {
  const budget = await partnerBudget(partnerId, existingId);
  const problem = fundingProblem(body, budget.available);
  if (problem) throw badRequest(problem);
  if (body.submit && !body.attest) throw badRequest('Confirm that funding approval will be obtained before committing spend.');
  if (body.kitId) {
    const kit = await prisma.campaignKit.findUnique({ where: { id: body.kitId } });
    if (!kit) throw badRequest('Unknown campaign kit.');
  }
  const data = {
    title: body.title,
    kitId: body.kitId ?? null,
    quarter: body.quarter,
    date: body.date,
    type: body.type,
    objective: body.objective,
    eligibleCost: body.eligibleCost,
    amount: body.amount,
    ...(body.submit ? { status: 'Submitted', submittedBy: userId, submittedAt: new Date(), feedback: null } : {}),
  };
  if (existingId) return prisma.fundingRequest.update({ where: { id: existingId }, data });
  return prisma.fundingRequest.create({ data: { ...data, partnerId, code: await nextCode('MDF') } });
}

fundingRouter.post('/', requireRole('PARTNER'), async (req, res) => {
  const user = req.user!;
  const body = FundingBody.parse(req.body);
  const saved = await saveFunding(body, ownPartnerId(user), user.id);
  await audit({ userId: user.id, entity: 'funding', entityId: saved.id, action: 'Created', toStatus: saved.status });
  if (body.submit) await audit({ userId: user.id, entity: 'funding', entityId: saved.id, action: 'Submitted for review', fromStatus: 'Draft', toStatus: 'Submitted' });
  res.status(201).json(serializeFunding(await loadFunding(saved.id, user)));
});

fundingRouter.put('/:id', requireRole('PARTNER'), async (req, res) => {
  const user = req.user!;
  const f = await loadFunding(Number(req.params.id), user);
  if (isLocked(f.status)) throw conflict(`This request is ${f.status.toLowerCase()} and can no longer be edited.`);
  const body = FundingBody.parse(req.body);
  await saveFunding(body, f.partnerId, user.id, f.id);
  await audit({
    userId: user.id,
    entity: 'funding',
    entityId: f.id,
    action: body.submit ? 'Submitted for review' : 'Draft saved',
    fromStatus: f.status,
    toStatus: body.submit ? 'Submitted' : f.status,
  });
  res.json(serializeFunding(await loadFunding(f.id, user)));
});

fundingRouter.delete('/:id', requireRole('PARTNER'), async (req, res) => {
  const f = await loadFunding(Number(req.params.id), req.user!);
  if (f.status !== 'Draft') throw conflict('Only drafts can be deleted.');
  await prisma.fundingRequest.delete({ where: { id: f.id } });
  res.json({ ok: true });
});

fundingRouter.post('/:id/decision', requireRole('REVIEWER'), async (req, res) => {
  const user = req.user!;
  const f = await loadFunding(Number(req.params.id), user);
  const { decision, note } = Decision.parse(req.body);
  if (f.status !== 'Submitted') throw conflict('Only submitted requests can be reviewed.');
  if (f.submittedBy === user.id) throw forbidden('You cannot decide a request you submitted.');
  if (decision !== 'Approved' && !note) throw badRequest('Give the partner a reason.');
  if (decision === 'Approved') {
    const budget = await partnerBudget(f.partnerId, f.id);
    if (f.amount > budget.available) throw conflict('Not enough budget left to approve this request.');
  }
  await prisma.fundingRequest.update({
    where: { id: f.id },
    data: { status: decision, feedback: note || null, decidedBy: user.id, decidedAt: new Date() },
  });
  await audit({ userId: user.id, entity: 'funding', entityId: f.id, action: `Decision: ${decision}`, fromStatus: f.status, toStatus: decision, note });
  res.json(serializeFunding(await loadFunding(f.id, user)));
});

// Start the campaign linked to an approved request. Creates its draft claim too.
fundingRouter.post('/:id/start', requireRole('PARTNER'), async (req, res) => {
  const user = req.user!;
  const f = await loadFunding(Number(req.params.id), user);
  if (f.status !== 'Approved') throw conflict('Funding must be approved before the campaign can start.');
  if (!f.campaign) {
    const campaign = await prisma.campaign.create({ data: { fundingId: f.id } });
    await prisma.claim.create({ data: { campaignId: campaign.id, code: await nextCode('CLM') } });
    await audit({ userId: user.id, entity: 'funding', entityId: f.id, action: 'Campaign started' });
  }
  res.json(serializeFunding(await loadFunding(f.id, user)));
});
