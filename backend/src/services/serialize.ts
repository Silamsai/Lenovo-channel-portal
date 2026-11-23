import type { Campaign, CampaignFile, Claim, FundingRequest, Partner } from '@prisma/client';
import { EVIDENCE_KINDS, METRIC_FIELDS, claimLimit, resultsProblem, type CampaignType } from './rules';

export type FundingWithAll = FundingRequest & {
  partner: Partner;
  campaign: (Campaign & { files: CampaignFile[]; claim: Claim | null }) | null;
};

export const fundingInclude = {
  partner: true,
  campaign: { include: { files: true, claim: true } },
} as const;

export function parseMetrics(c: Campaign | null): Record<string, number | string> {
  if (!c?.metrics) return {};
  try {
    return JSON.parse(c.metrics);
  } catch {
    return {};
  }
}

const fileOut = (f: CampaignFile) => ({ id: f.id, kind: f.kind, name: f.name, size: f.size, mime: f.mime, uploadedAt: f.uploadedAt });

/** One shape used by every list and detail screen. */
export function serializeFunding(f: FundingWithAll) {
  const c = f.campaign;
  const metrics = parseMetrics(c);
  const resultsReady = !!c && c.actualSpend !== null && !resultsProblem(f.type, metrics, c.actualSpend);
  const assets = c?.files.filter((x) => x.kind === 'asset') ?? [];
  const evidence = Object.fromEntries(
    EVIDENCE_KINDS.map((k) => [k, (c?.files ?? []).filter((x) => x.kind === k).map(fileOut)]),
  ) as Record<(typeof EVIDENCE_KINDS)[number], ReturnType<typeof fileOut>[]>;
  const assetsApproved = !!c && c.assetStatus === 'Approved' && assets.length > 0;
  const evidenceComplete = EVIDENCE_KINDS.every((k) => evidence[k].length > 0);
  return {
    id: f.id,
    code: f.code,
    partner: { id: f.partner.id, name: f.partner.name, code: f.partner.code },
    kitId: f.kitId,
    title: f.title,
    quarter: f.quarter,
    date: f.date,
    type: f.type,
    objective: f.objective,
    eligibleCost: f.eligibleCost,
    amount: f.amount,
    status: f.status,
    feedback: f.feedback,
    submittedAt: f.submittedAt,
    decidedAt: f.decidedAt,
    updatedAt: f.updatedAt,
    campaign: c
      ? {
          id: c.id,
          startedAt: c.startedAt,
          completedAt: c.completedAt,
          metrics,
          metricFields: METRIC_FIELDS[f.type as CampaignType] ?? [],
          actualSpend: c.actualSpend,
          resultsReady,
          assetStatus: c.assetStatus,
          assetVersion: c.assetVersion,
          assetNote: c.assetNote,
          assetsApproved,
          assets: assets.map(fileOut),
          evidence,
          evidenceComplete,
          claim: c.claim
            ? {
                id: c.claim.id,
                code: c.claim.code,
                amount: c.claim.amount,
                attested: c.claim.attested,
                status: c.claim.status,
                note: c.claim.note,
                submittedAt: c.claim.submittedAt,
                decidedAt: c.claim.decidedAt,
                paymentRef: c.claim.paymentRef,
                paidAt: c.claim.paidAt,
                limit: claimLimit(f.amount, c.actualSpend),
              }
            : null,
        }
      : null,
  };
}

export type FundingOut = ReturnType<typeof serializeFunding>;
