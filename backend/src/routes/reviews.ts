import { Router } from 'express';
import { prisma } from '../db';
import { requireRole } from '../middleware/auth';
import { partnerBudget } from '../services/budget';
import { fundingInclude, serializeFunding } from '../services/serialize';

export const reviewsRouter = Router();

/** Everything waiting for a programme decision. */
reviewsRouter.get('/queue', requireRole('REVIEWER'), async (_req, res) => {
  const [funding, assets, claims, payments, benefits, points] = await Promise.all([
    prisma.fundingRequest.findMany({ where: { status: 'Submitted' }, include: fundingInclude, orderBy: { submittedAt: 'asc' } }),
    prisma.fundingRequest.findMany({ where: { campaign: { assetStatus: 'Submitted' } }, include: fundingInclude }),
    prisma.fundingRequest.findMany({ where: { campaign: { claim: { status: 'Submitted' } } }, include: fundingInclude }),
    prisma.fundingRequest.findMany({ where: { campaign: { claim: { status: 'Approved', paidAt: null } } }, include: fundingInclude }),
    prisma.benefitRequest.findMany({ where: { status: 'Pending' }, include: { partner: true, benefit: true }, orderBy: { createdAt: 'asc' } }),
    prisma.pointsEntry.findMany({ where: { status: 'Pending' }, include: { partner: true, reward: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  res.json({
    funding: await Promise.all(
      funding.map(async (f) => ({ ...serializeFunding(f), available: (await partnerBudget(f.partnerId, f.id)).available })),
    ),
    assets: assets.map(serializeFunding),
    claims: claims.map(serializeFunding),
    payments: payments.map(serializeFunding),
    benefits: benefits.map((b) => ({ id: b.id, partner: b.partner.name, benefit: b.benefit.name, note: b.note, createdAt: b.createdAt })),
    points: points.map((p) => ({
      id: p.id,
      partner: p.partner.name,
      kind: p.kind,
      points: p.points,
      reason: p.reason,
      evidence: p.evidence,
      createdAt: p.createdAt,
    })),
  });
});
