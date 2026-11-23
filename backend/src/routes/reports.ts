import { db } from '../db';
import { auth } from '../auth';
import { sendDownload } from '../lib/http';
import { Router, type Ctx } from '../lib/router';
import { round2 } from '../services/rules';
import { loadFunding } from '../services/serialize';

export const reportRoutes = new Router();

async function buildReport(ctx: Ctx) {
  const user = ctx.me;
  const quarter = ctx.query.get('quarter');
  const conditions = [`f.status <> 'Draft'`];
  const params: unknown[] = [];
  if (user.role === 'PARTNER') {
    params.push(user.partnerId);
    conditions.push(`f.partner_id = $${params.length}`);
  }
  if (quarter && quarter !== 'all') {
    params.push(quarter);
    conditions.push(`f.quarter = $${params.length}`);
  }
  const rows = await loadFunding(conditions.join(' AND '), params, 'f.date, f.id');
  const exports = await db.one(
    user.role === 'PARTNER'
      ? `SELECT COUNT(*)::int AS n FROM audit_log a JOIN users u ON u.id = a.user_id WHERE a.entity = 'kit' AND a.action = 'Exported' AND u.partner_id = $1`
      : `SELECT COUNT(*)::int AS n FROM audit_log WHERE entity = 'kit' AND action = 'Exported'`,
    user.role === 'PARTNER' ? [user.partnerId] : [],
  );
  const claims = rows.map((r) => r.campaign?.claim).filter((c): c is NonNullable<typeof c> => !!c);
  const sum = (xs: (number | null)[]) => round2(xs.reduce<number>((n, x) => n + (x ?? 0), 0));
  return {
    totals: {
      requested: sum(rows.map((r) => r.amount)),
      approved: sum(rows.filter((r) => r.status === 'Approved').map((r) => r.amount)),
      kitExports: exports.n as number,
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

reportRoutes.get('/', auth, buildReport);

reportRoutes.get('/export.csv', auth, async (ctx) => {
  const report = await buildReport(ctx);
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
  sendDownload(ctx.res, lines.map((l) => l.map(cell).join(',')).join('\n'), 'channel-report.csv', 'text/csv; charset=utf-8');
  ctx.sent = true;
});
