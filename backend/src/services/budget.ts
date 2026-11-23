import { db } from '../db';
import { round2 } from './rules';

/** Budget for a partner. Approved and submitted requests reserve funds. */
export async function partnerBudget(partnerId: number, excludeFundingId = 0) {
  const row = await db.one(
    `SELECT p.annual_budget AS budget,
            COALESCE(SUM(f.amount) FILTER (WHERE f.status = 'Approved'), 0) AS approved,
            COALESCE(SUM(f.amount) FILTER (WHERE f.status = 'Submitted'), 0) AS pending
       FROM partners p
       LEFT JOIN funding_requests f ON f.partner_id = p.id AND f.id <> $2
      WHERE p.id = $1
      GROUP BY p.id`,
    [partnerId, excludeFundingId],
  );
  const approved = round2(Number(row.approved));
  const pending = round2(Number(row.pending));
  return { budget: Number(row.budget), approved, pending, available: round2(Number(row.budget) - approved - pending) };
}
