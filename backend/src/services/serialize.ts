import { db, type Row } from '../db';
import { EVIDENCE_KINDS, METRIC_FIELDS, claimLimit, resultsProblem, type CampaignType, type EvidenceKind } from './rules';

/**
 * Loads funding requests with partner, campaign, files and claim, and returns the one
 * shape every list and detail screen uses. `where` is a SQL condition on alias `f`.
 */
export async function loadFunding(where: string, params: unknown[] = [], orderBy = 'f.date DESC, f.id DESC') {
  const rows = await db.many(
    `SELECT f.*, p.name AS partner_name, p.code AS partner_code
       FROM funding_requests f JOIN partners p ON p.id = f.partner_id
      WHERE ${where}
      ORDER BY ${orderBy}`,
    params,
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const campaigns = await db.many('SELECT * FROM campaigns WHERE funding_id = ANY($1::int[])', [ids]);
  const campaignIds = campaigns.map((c) => c.id);
  const [files, claims] = campaignIds.length
    ? await Promise.all([
        db.many('SELECT * FROM campaign_files WHERE campaign_id = ANY($1::int[]) ORDER BY id', [campaignIds]),
        db.many('SELECT * FROM claims WHERE campaign_id = ANY($1::int[])', [campaignIds]),
      ])
    : [[], []];
  return rows.map((f) => {
    const c = campaigns.find((x) => x.fundingId === f.id);
    return serialize(f, c, c ? files.filter((x) => x.campaignId === c.id) : [], c ? claims.find((x) => x.campaignId === c.id) : undefined);
  });
}

/** Stored file names, for building downloads and exports. Never sent to clients. */
export async function storedFiles(campaignId: number) {
  return db.many<{ id: number; storedAs: string; kind: string; name: string; size: number }>(
    'SELECT id, stored_as, kind, name, size FROM campaign_files WHERE campaign_id = $1',
    [campaignId],
  );
}

const fileOut = (f: Row) => ({ id: f.id as number, kind: f.kind as string, name: f.name as string, size: f.size as number, mime: f.mime as string, uploadedAt: f.uploadedAt as Date });

function serialize(f: Row, c: Row | undefined, files: Row[], claim: Row | undefined) {
  const metrics: Record<string, number> = c?.metrics ?? {};
  const resultsReady = !!c && c.actualSpend !== null && !resultsProblem(f.type, metrics, c.actualSpend);
  const assets = files.filter((x) => x.kind === 'asset');
  const evidence = Object.fromEntries(EVIDENCE_KINDS.map((k) => [k, files.filter((x) => x.kind === k).map(fileOut)])) as Record<EvidenceKind, ReturnType<typeof fileOut>[]>;
  const assetsApproved = !!c && c.assetStatus === 'Approved' && assets.length > 0;
  return {
    id: f.id as number,
    code: f.code as string,
    partnerId: f.partnerId as number,
    partner: { id: f.partnerId as number, name: f.partnerName as string, code: f.partnerCode as string },
    kitId: f.kitId as number | null,
    title: f.title as string,
    quarter: f.quarter as string,
    date: f.date as string,
    type: f.type as string,
    objective: f.objective as string,
    eligibleCost: f.eligibleCost as number,
    amount: f.amount as number,
    status: f.status as string,
    feedback: f.feedback as string | null,
    submittedBy: f.submittedBy as number | null,
    submittedAt: f.submittedAt as Date | null,
    decidedAt: f.decidedAt as Date | null,
    updatedAt: f.updatedAt as Date,
    campaign: c
      ? {
          id: c.id as number,
          startedAt: c.startedAt as Date,
          completedAt: c.completedAt as Date | null,
          metrics,
          metricFields: METRIC_FIELDS[f.type as CampaignType] ?? [],
          actualSpend: c.actualSpend as number | null,
          resultsReady,
          assetStatus: c.assetStatus as string,
          assetVersion: c.assetVersion as number,
          assetNote: c.assetNote as string | null,
          assetBy: c.assetBy as number | null,
          assetsApproved,
          assets: assets.map(fileOut),
          evidence,
          evidenceComplete: EVIDENCE_KINDS.every((k) => evidence[k].length > 0),
          claim: claim
            ? {
                id: claim.id as number,
                code: claim.code as string,
                amount: claim.amount as number | null,
                attested: claim.attested as boolean,
                status: claim.status as string,
                note: claim.note as string | null,
                submittedBy: claim.submittedBy as number | null,
                submittedAt: claim.submittedAt as Date | null,
                decidedAt: claim.decidedAt as Date | null,
                paymentRef: claim.paymentRef as string | null,
                paidAt: claim.paidAt as string | null,
                limit: claimLimit(f.amount, c.actualSpend),
              }
            : null,
        }
      : null,
  };
}

export type FundingOut = ReturnType<typeof serialize>;

/** Strips internal ids (who submitted) before sending to clients. */
export function publicFunding(f: FundingOut) {
  const { submittedBy: _s, ...rest } = f;
  return {
    ...rest,
    campaign: rest.campaign
      ? { ...rest.campaign, assetBy: undefined, claim: rest.campaign.claim ? { ...rest.campaign.claim, submittedBy: undefined } : null }
      : null,
  };
}
