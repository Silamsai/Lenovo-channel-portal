import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { assertPartnerAccess, ownPartnerId, requireRole } from '../middleware/auth';
import { badRequest, conflict, notFound } from '../middleware/errors';
import { audit } from '../services/audit';
import { POINTS_PER_ACTIVITY } from '../services/rules';

/** Partner network, benefits and rewards. */
export const programmeRouter = Router();

async function pointsFor(partnerId: number) {
  const entries = await prisma.pointsEntry.findMany({ where: { partnerId }, include: { reward: true }, orderBy: { createdAt: 'desc' } });
  const balance = entries.filter((e) => e.status === 'Approved').reduce((n, e) => n + e.points, 0);
  const reserved = entries.filter((e) => e.status === 'Pending' && e.kind === 'redeem').reduce((n, e) => n - e.points, 0);
  return { entries, balance, available: balance - reserved };
}

// ---------- Partners ----------

programmeRouter.get('/partners', requireRole('REVIEWER'), async (_req, res) => {
  const partners = await prisma.partner.findMany({ orderBy: { code: 'asc' }, include: { benefitRequests: { where: { status: 'Pending' } } } });
  res.json(
    await Promise.all(
      partners.map(async ({ benefitRequests, ...p }) => ({ ...p, points: (await pointsFor(p.id)).balance, pendingBenefits: benefitRequests.length })),
    ),
  );
});

programmeRouter.get('/partners/:id', async (req, res) => {
  const id = req.params.id === 'me' ? ownPartnerId(req.user!) : Number(req.params.id);
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw notFound('Partner not found.');
  assertPartnerAccess(req.user!, partner.id);
  res.json({ ...partner, points: (await pointsFor(partner.id)).balance });
});

const ProfileBody = z.object({
  name: z.string().trim().min(1).max(80),
  contact: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  focus: z.enum(['ThinkPad workplace', 'ThinkSystem infrastructure', 'ThinkStation creators']),
  goal: z.string().trim().min(1).max(500),
});

programmeRouter.put('/partners/:id', async (req, res) => {
  const id = req.params.id === 'me' ? ownPartnerId(req.user!) : Number(req.params.id);
  assertPartnerAccess(req.user!, id);
  const body = ProfileBody.parse(req.body);
  const saved = await prisma.partner.update({ where: { id }, data: body });
  await audit({ userId: req.user!.id, entity: 'partner', entityId: id, action: 'Profile updated' });
  res.json(saved);
});

// ---------- Benefits ----------

programmeRouter.get('/benefits', async (req, res) => {
  const user = req.user!;
  const items = await prisma.benefitItem.findMany({ orderBy: { id: 'asc' } });
  const partner = user.partnerId ? await prisma.partner.findUnique({ where: { id: user.partnerId } }) : null;
  const requests = await prisma.benefitRequest.findMany({
    where: user.role === 'PARTNER' ? { partnerId: user.partnerId! } : {},
    include: { benefit: true, partner: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    items: items.map((b) => ({ ...b, eligible: !partner || b.segment === 'All' || b.segment === partner.segment })),
    requests: requests.map((r) => ({
      id: r.id,
      benefit: r.benefit.name,
      partner: r.partner.name,
      note: r.note,
      status: r.status,
      decisionNote: r.decisionNote,
      createdAt: r.createdAt,
    })),
  });
});

programmeRouter.post('/benefits/:id/request', requireRole('PARTNER'), async (req, res) => {
  const partnerId = ownPartnerId(req.user!);
  const { note } = z.object({ note: z.string().trim().min(1, 'Tell us what you need.').max(500) }).parse(req.body);
  const benefit = await prisma.benefitItem.findUnique({ where: { id: Number(req.params.id) } });
  if (!benefit) throw notFound('Benefit not found.');
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
  if (benefit.segment !== 'All' && benefit.segment !== partner.segment) throw badRequest(`This benefit is for ${benefit.segment} partners.`);
  const pending = await prisma.benefitRequest.count({ where: { partnerId, benefitId: benefit.id, status: 'Pending' } });
  if (pending) throw conflict('You already have a pending request for this benefit.');
  const saved = await prisma.benefitRequest.create({ data: { partnerId, benefitId: benefit.id, note } });
  await audit({ userId: req.user!.id, entity: 'benefit', entityId: saved.id, action: 'Requested', toStatus: 'Pending' });
  res.status(201).json(saved);
});

const Decision = z.object({ decision: z.enum(['Approved', 'Rejected']), note: z.string().trim().max(500).default('') });

programmeRouter.post('/benefits/requests/:id/decision', requireRole('REVIEWER'), async (req, res) => {
  const { decision, note } = Decision.parse(req.body);
  const r = await prisma.benefitRequest.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) throw notFound();
  if (r.status !== 'Pending') throw conflict('Only pending requests can be decided.');
  if (decision === 'Rejected' && !note) throw badRequest('Give the partner a reason.');
  await prisma.benefitRequest.update({ where: { id: r.id }, data: { status: decision, decisionNote: note || null } });
  await audit({ userId: req.user!.id, entity: 'benefit', entityId: r.id, action: `Decision: ${decision}`, fromStatus: 'Pending', toStatus: decision, note });
  res.json({ ok: true });
});

// ---------- Rewards ----------

programmeRouter.get('/rewards', async (req, res) => {
  const user = req.user!;
  const items = await prisma.rewardItem.findMany({ orderBy: { cost: 'asc' } });
  if (user.role === 'REVIEWER') {
    res.json({ items, pointsPerActivity: POINTS_PER_ACTIVITY, balance: null, available: null, entries: [] });
    return;
  }
  const { entries, balance, available } = await pointsFor(user.partnerId!);
  res.json({
    items,
    pointsPerActivity: POINTS_PER_ACTIVITY,
    balance,
    available,
    entries: entries.map((e) => ({ id: e.id, kind: e.kind, points: e.points, reason: e.reason, status: e.status, decisionNote: e.decisionNote, createdAt: e.createdAt })),
  });
});

programmeRouter.post('/rewards/earn', requireRole('PARTNER'), async (req, res) => {
  const partnerId = ownPartnerId(req.user!);
  const body = z
    .object({ activity: z.string().trim().min(1, 'Name the activity.').max(120), evidence: z.string().trim().min(1, 'Describe the evidence.').max(500) })
    .parse(req.body);
  const saved = await prisma.pointsEntry.create({
    data: { partnerId, kind: 'earn', points: POINTS_PER_ACTIVITY, reason: body.activity, evidence: body.evidence },
  });
  await audit({ userId: req.user!.id, entity: 'points', entityId: saved.id, action: 'Earn submitted', toStatus: 'Pending' });
  res.status(201).json(saved);
});

programmeRouter.post('/rewards/:id/redeem', requireRole('PARTNER'), async (req, res) => {
  const partnerId = ownPartnerId(req.user!);
  const reward = await prisma.rewardItem.findUnique({ where: { id: Number(req.params.id) } });
  if (!reward) throw notFound('Reward not found.');
  const { available } = await pointsFor(partnerId);
  if (available < reward.cost) throw badRequest(`Not enough points: ${available} available, ${reward.cost} needed.`);
  const saved = await prisma.pointsEntry.create({
    data: { partnerId, kind: 'redeem', points: -reward.cost, reason: `Redeem: ${reward.name}`, rewardId: reward.id },
  });
  await audit({ userId: req.user!.id, entity: 'points', entityId: saved.id, action: 'Redemption requested', toStatus: 'Pending' });
  res.status(201).json(saved);
});

programmeRouter.post('/rewards/entries/:id/decision', requireRole('REVIEWER'), async (req, res) => {
  const { decision, note } = Decision.parse(req.body);
  const e = await prisma.pointsEntry.findUnique({ where: { id: Number(req.params.id) } });
  if (!e) throw notFound();
  if (e.status !== 'Pending') throw conflict('Only pending entries can be decided.');
  if (decision === 'Rejected' && !note) throw badRequest('Give the partner a reason.');
  if (decision === 'Approved' && e.kind === 'redeem') {
    const { balance } = await pointsFor(e.partnerId);
    if (balance + e.points < 0) throw conflict('The partner no longer has enough points.');
  }
  await prisma.pointsEntry.update({ where: { id: e.id }, data: { status: decision, decisionNote: note || null } });
  await audit({ userId: req.user!.id, entity: 'points', entityId: e.id, action: `Decision: ${decision}`, fromStatus: 'Pending', toStatus: decision, note });
  res.json({ ok: true });
});
