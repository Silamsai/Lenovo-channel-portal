import { Router, type Request } from 'express';
import { prisma } from '../db';
import { fundingInclude, serializeFunding } from '../services/serialize';
import { round2 } from '../services/rules';

export const reportsRouter = Router();

async function buildReport(req: Request) {
  const user = req.user!;
  const quarter = typeof req.query.quarter === 'string' && req.query.quarter !== 'all' ? req.query.quarter : undefined;
  const partnerFilter = user.role === 'PARTNER' ? { partnerId: user.partnerId! } : {};
  const rows = (
    await prisma.fundingRequest.findMany({
      where: { ...partnerFilter, ...(quarter ? { quarter } : {}), status: { not: 'Draft' } },
      include: fundingInclude,
      orderBy: { date: 'asc' },
    })
  ).map(serializeFunding);

  const exportUsers = user.role === 'PARTNER' ? (await prisma.user.findMany({ where: { partnerId: user.partnerId! } })).map((u) => u.id) : undefined;
  const exports = await prisma.auditLog.count({
    where: { entity: 'kit', action: 'Exported', ...(exportUsers ? { userId: { in: exportUsers } } : {}) },
  });

  const claims = rows.map((r) => r.campaign?.claim).filter((c): c is NonNullable<typeof c> => !!c);
  const sum = (xs: (number | null)[]) => round2(xs.reduce<number>((n, x) => n + (x ?? 0), 0));
  return {
    totals: {
      requested: sum(rows.map((r) => r.amount)),
      approved: sum(rows.filter((r) => r.status === 'Approved').map((r) => r.amount)),
      kitExports: exports,
      launched: rows.filter((r) => r.campaign).length,
      completed: rows.filter((r) => r.campaign?.completedAt).length,
      claimsApproved: sum(claims.filter((c) => c.status === 'Approved').map((c) => c.amount)),
      paid: sum(claims.filter((c) => c.paidAt).map((c) => c.amount)),
    },
    campaigns: rows
      .filter((r) => r.campaign)
      .map((r) => {
        const c = r.campaign!;
        const steps = [c.assetsApproved, c.resultsReady, c.evidenceComplete, ['Submitted', 'Approved'].includes(c.claim?.status ?? '')];
        return {
          id: r.id,
          code: r.code,
          title: r.title,
          partner: r.partner.name,
          quarter: r.quarter,
          type: r.type,
          amount: r.amount,
          readiness: Math.round((steps.filter(Boolean).length / steps.length) * 100),
          resultsReady: c.resultsReady,
          metrics: c.metricFields.map(([k, label]) => ({ label, value: c.metrics[k] ?? null })),
          actualSpend: c.actualSpend,
          claimStatus: c.claim?.status ?? null,
          claimAmount: c.claim?.amount ?? null,
          paid: !!c.claim?.paidAt,
        };
      }),
  };
}

reportsRouter.get('/', async (req, res) => {
  res.json(await buildReport(req));
});

reportsRouter.get('/export.csv', async (req, res) => {
  const report = await buildReport(req);
  const cell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ['Funding', 'Campaign', 'Partner', 'Quarter', 'Type', 'Approved GBP', 'Actual spend GBP', 'Claim status', 'Claim GBP', 'Paid', 'Results'],
    ...report.campaigns.map((c) => [
      c.code,
      c.title,
      c.partner,
      c.quarter,
      c.type,
      c.amount,
      c.actualSpend ?? '',
      c.claimStatus ?? '',
      c.claimAmount ?? '',
      c.paid ? 'Yes' : 'No',
      c.metrics.map((m) => `${m.label}: ${m.value ?? '-'}`).join('; '),
    ]),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="channel-report.csv"');
  res.send(lines.map((l) => l.map(cell).join(',')).join('\n'));
});
