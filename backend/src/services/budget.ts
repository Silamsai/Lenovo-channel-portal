import { prisma } from '../db';
import { round2 } from './rules';

/** Budget for a partner. Approved and submitted requests reserve funds. */
export async function partnerBudget(partnerId: number, excludeFundingId?: number) {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
  const rows = await prisma.fundingRequest.findMany({
    where: {
      partnerId,
      status: { in: ['Approved', 'Submitted'] },
      ...(excludeFundingId ? { id: { not: excludeFundingId } } : {}),
    },
    select: { amount: true, status: true },
  });
  const approved = round2(rows.filter((r) => r.status === 'Approved').reduce((n, r) => n + r.amount, 0));
  const pending = round2(rows.filter((r) => r.status === 'Submitted').reduce((n, r) => n + r.amount, 0));
  return {
    budget: partner.annualBudget,
    approved,
    pending,
    available: round2(partner.annualBudget - approved - pending),
  };
}
