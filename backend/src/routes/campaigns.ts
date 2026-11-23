import fs from 'fs';
import { z } from 'zod';
import { db } from '../db';
import { auth, role, type AuthUser } from '../auth';
import { badRequest, conflict, forbidden, notFound, sendDownload } from '../lib/http';
import { Router, type Ctx } from '../lib/router';
import { audit, history } from '../services/audit';
import { MAX_CAMPAIGN_BYTES, filePath, removeStored, saveUploads, type Saved } from '../services/files';
import { buildPoePack } from '../services/poeExport';
import { EVIDENCE_KINDS, METRIC_FIELDS, gbp, isLocked, resultsProblem, round2, type CampaignType } from '../services/rules';
import { publicFunding, storedFiles, type FundingOut } from '../services/serialize';
import { settings } from '../services/settings';
import { getFunding } from './funding';

/** Campaign URLs use the funding request id (one campaign per funding request). */
export const campaignRoutes = new Router();

async function getCampaign(ctx: Ctx) {
  const f = await getFunding(ctx.param('fid'), ctx.me);
  if (!f.campaign || !f.campaign.claim) throw conflict('This campaign has not been started yet.');
  return { f, c: f.campaign, claim: f.campaign.claim };
}
type Loaded = Awaited<ReturnType<typeof getCampaign>>;

const respond = async (fid: number, user: AuthUser) => publicFunding(await getFunding(fid, user));
const unattest = (claimId: number) => db.run('UPDATE claims SET attested = false WHERE id = $1', [claimId]);

async function addFiles(c: Loaded['c'], kind: string, saved: Saved[]) {
  const used = await db.one('SELECT COALESCE(SUM(size), 0)::bigint AS total FROM campaign_files WHERE campaign_id = $1', [c.id]);
  if (Number(used.total) + saved.reduce((n, f) => n + f.size, 0) > MAX_CAMPAIGN_BYTES) throw badRequest('Maximum 100 MB of files per campaign.');
  for (const f of saved) {
    await db.run('INSERT INTO campaign_files (campaign_id, kind, name, stored_as, size, mime) VALUES ($1,$2,$3,$4,$5,$6)', [c.id, kind, f.name, f.storedAs, f.size, f.mime]);
  }
}

/** Runs an upload step; removes the written files again if anything is refused. */
async function withUploads(ctx: Ctx, fn: (saved: Saved[]) => Promise<void>) {
  const saved = await saveUploads(await ctx.form());
  try {
    await fn(saved);
  } catch (err) {
    saved.forEach((f) => removeStored(f.storedAs));
    throw err;
  }
}

// ---------- Detail ----------

campaignRoutes.get('/:fid', auth, async (ctx) => {
  const { f, c, claim } = await getCampaign(ctx);
  return {
    item: publicFunding(f),
    history: { funding: await history('funding', f.id), assets: await history('assets', c.id), claim: await history('claim', claim.id) },
  };
});

// ---------- Campaign assets (versioned approval) ----------

/** Any change to approved assets starts a new version that needs approval again. */
async function beforeAssetChange({ c, claim }: Loaded, userId: number) {
  if (isLocked(claim.status)) throw conflict('Assets are locked while the claim is submitted or decided.');
  if (c.assetStatus === 'Submitted') throw conflict('Assets are awaiting review and cannot change until a decision is made.');
  if (c.assetStatus === 'Approved') {
    const note = 'Assets changed after approval. Submit this new version for review.';
    await db.run(`UPDATE campaigns SET asset_version = asset_version + 1, asset_status = 'Draft', asset_note = $1 WHERE id = $2`, [note, c.id]);
    await audit({ userId, entity: 'assets', entityId: c.id, action: `Version ${c.assetVersion + 1} started`, fromStatus: 'Approved', toStatus: 'Draft', note });
  }
}

campaignRoutes.post('/:fid/assets', auth, role('PARTNER'), async (ctx) => {
  const loaded = await getCampaign(ctx);
  await withUploads(ctx, async (saved) => {
    await beforeAssetChange(loaded, ctx.me.id);
    await addFiles(loaded.c, 'asset', saved);
  });
  await unattest(loaded.claim.id);
  return respond(loaded.f.id, ctx.me);
});

campaignRoutes.delete('/:fid/assets/:fileId', auth, role('PARTNER'), async (ctx) => {
  const loaded = await getCampaign(ctx);
  const file = await db.maybe(`SELECT id, stored_as FROM campaign_files WHERE id = $1 AND campaign_id = $2 AND kind = 'asset'`, [ctx.param('fileId'), loaded.c.id]);
  if (!file) throw notFound('File not found.');
  await beforeAssetChange(loaded, ctx.me.id);
  await db.run('DELETE FROM campaign_files WHERE id = $1', [file.id]);
  removeStored(file.storedAs);
  await unattest(loaded.claim.id);
  return respond(loaded.f.id, ctx.me);
});

campaignRoutes.post('/:fid/assets/submit', auth, role('PARTNER'), async (ctx) => {
  const { f, c, claim } = await getCampaign(ctx);
  if (isLocked(claim.status)) throw conflict('Assets are locked with the claim.');
  if (!['Draft', 'Changes requested'].includes(c.assetStatus)) throw conflict(`Assets are already ${c.assetStatus.toLowerCase()}.`);
  if (!c.assets.length) throw badRequest('Upload at least one campaign asset first.');
  await db.run(`UPDATE campaigns SET asset_status = 'Submitted', asset_by = $1, asset_note = NULL WHERE id = $2`, [ctx.me.id, c.id]);
  await audit({ userId: ctx.me.id, entity: 'assets', entityId: c.id, action: `Version ${c.assetVersion} submitted`, fromStatus: c.assetStatus, toStatus: 'Submitted' });
  return respond(f.id, ctx.me);
});

const Decision = z.object({
  decision: z.enum(['Approved', 'Changes requested', 'Rejected']),
  note: z.string().trim().max(1000).default(''),
});

campaignRoutes.post('/:fid/assets/decision', auth, role('REVIEWER'), async (ctx) => {
  const { f, c } = await getCampaign(ctx);
  const { decision, note } = Decision.parse(await ctx.json());
  if (decision === 'Rejected') throw badRequest('Assets can be approved or sent back for changes.');
  if (c.assetStatus !== 'Submitted') throw conflict('Only submitted assets can be reviewed.');
  if (c.assetBy === ctx.me.id) throw forbidden('You cannot review assets you submitted.');
  if (decision !== 'Approved' && !note) throw badRequest('Tell the partner what to change.');
  await db.run('UPDATE campaigns SET asset_status = $1, asset_note = $2 WHERE id = $3', [decision, note || null, c.id]);
  await audit({ userId: ctx.me.id, entity: 'assets', entityId: c.id, action: `Version ${c.assetVersion}: ${decision}`, fromStatus: 'Submitted', toStatus: decision, note });
  return respond(f.id, ctx.me);
});

// ---------- Performance ----------

const PerformanceBody = z.object({
  metrics: z.record(z.union([z.number(), z.string()])),
  spend: z.union([z.number(), z.string()]),
  complete: z.boolean().default(false),
});

campaignRoutes.put('/:fid/performance', auth, role('PARTNER'), async (ctx) => {
  const { f, c, claim } = await getCampaign(ctx);
  if (isLocked(claim.status)) throw conflict('Performance is locked with the submitted claim.');
  const body = PerformanceBody.parse(await ctx.json());
  const problem = resultsProblem(f.type, body.metrics, body.spend);
  if (problem) throw badRequest(problem);
  const metrics = Object.fromEntries(METRIC_FIELDS[f.type as CampaignType].map(([k]) => [k, Number(body.metrics[k])]));
  await db.run(
    `UPDATE campaigns SET metrics = $1::jsonb, actual_spend = $2, completed_at = CASE WHEN $3::boolean THEN COALESCE(completed_at, now()) ELSE NULL END WHERE id = $4`,
    [JSON.stringify(metrics), round2(Number(body.spend)), body.complete, c.id],
  );
  await unattest(claim.id);
  return respond(f.id, ctx.me);
});

// ---------- Evidence ----------

campaignRoutes.post('/:fid/evidence/:kind', auth, role('PARTNER'), async (ctx) => {
  const kind = ctx.params.kind;
  if (!(EVIDENCE_KINDS as readonly string[]).includes(kind)) throw badRequest('Unknown evidence category.');
  const loaded = await getCampaign(ctx);
  if (isLocked(loaded.claim.status)) throw conflict('Evidence is locked with the submitted claim.');
  await withUploads(ctx, (saved) => addFiles(loaded.c, kind, saved));
  await unattest(loaded.claim.id);
  return respond(loaded.f.id, ctx.me);
});

campaignRoutes.delete('/:fid/evidence/:fileId', auth, role('PARTNER'), async (ctx) => {
  const { f, c, claim } = await getCampaign(ctx);
  if (isLocked(claim.status)) throw conflict('Evidence is locked with the submitted claim.');
  const file = await db.maybe(`SELECT id, stored_as FROM campaign_files WHERE id = $1 AND campaign_id = $2 AND kind <> 'asset'`, [ctx.param('fileId'), c.id]);
  if (!file) throw notFound('File not found.');
  await db.run('DELETE FROM campaign_files WHERE id = $1', [file.id]);
  removeStored(file.storedAs);
  await unattest(claim.id);
  return respond(f.id, ctx.me);
});

// ---------- Files and export ----------

campaignRoutes.get('/:fid/files/:fileId', auth, async (ctx) => {
  const { c } = await getCampaign(ctx);
  const file = await db.maybe('SELECT name, stored_as, mime FROM campaign_files WHERE id = $1 AND campaign_id = $2', [ctx.param('fileId'), c.id]);
  if (!file) throw notFound('File not found.');
  sendDownload(ctx.res, await fs.promises.readFile(filePath(file.storedAs)), file.name, file.mime);
  ctx.sent = true;
});

campaignRoutes.get('/:fid/export', auth, async (ctx) => {
  const { f, c, claim } = await getCampaign(ctx);
  const type = ctx.query.get('type') === 'zip' ? 'zip' : 'pptx';
  const buffer = await buildPoePack(f, await storedFiles(c.id), type);
  sendDownload(ctx.res, buffer, `${claim.code}-POE.${type}`, type === 'zip' ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  ctx.sent = true;
});

// ---------- Claim ----------

const ClaimBody = z.object({
  amount: z.number().positive('Claim must be greater than zero.'),
  attested: z.boolean(),
  submit: z.boolean().default(false),
});

function claimProblem(c: NonNullable<FundingOut['campaign']>, amount: number, attested: boolean) {
  const limit = c.claim!.limit;
  if (!c.assetsApproved) return 'The current campaign asset version must be approved.';
  if (!c.resultsReady) return 'Complete all mandatory campaign performance metrics.';
  if (!c.evidenceComplete) return 'Attach delivery evidence, a performance report and invoices.';
  if (amount > limit) return `Claim must be within ${gbp(limit)} (${settings().contributionPercent}% of eligible spend, capped at approved funding).`;
  if (!attested) return 'Confirm the claim declaration.';
  return '';
}

campaignRoutes.put('/:fid/claim', auth, role('PARTNER'), async (ctx) => {
  const { f, c, claim } = await getCampaign(ctx);
  if (isLocked(claim.status)) throw conflict(`Claim ${claim.code} is ${claim.status.toLowerCase()}.`);
  const body = ClaimBody.parse(await ctx.json());
  if (body.submit) {
    const problem = claimProblem(c, body.amount, body.attested);
    if (problem) throw badRequest(problem);
  } else if (body.amount > claim.limit) {
    throw badRequest(`Claim must be within ${gbp(claim.limit)}.`);
  }
  if (body.submit) {
    await db.run(`UPDATE claims SET amount=$1, attested=$2, status='Submitted', submitted_by=$3, submitted_at=now(), note=NULL WHERE id=$4`, [
      round2(body.amount),
      body.attested,
      ctx.me.id,
      claim.id,
    ]);
  } else {
    await db.run('UPDATE claims SET amount=$1, attested=$2 WHERE id=$3', [round2(body.amount), body.attested, claim.id]);
  }
  if (body.submit) await audit({ userId: ctx.me.id, entity: 'claim', entityId: claim.id, action: 'Claim submitted', fromStatus: claim.status, toStatus: 'Submitted' });
  return respond(f.id, ctx.me);
});

campaignRoutes.post('/:fid/claim/decision', auth, role('REVIEWER'), async (ctx) => {
  const { f, claim } = await getCampaign(ctx);
  const { decision, note } = Decision.parse(await ctx.json());
  if (claim.status !== 'Submitted') throw conflict('Only submitted claims can be reviewed.');
  if (claim.submittedBy === ctx.me.id) throw forbidden('You cannot decide a claim you submitted.');
  if (decision !== 'Approved' && !note) throw badRequest('Give the partner a reason.');
  await db.run(
    `UPDATE claims SET status=$1, note=$2, decided_by=$3, decided_at=now(), attested = CASE WHEN $1 = 'Approved' THEN attested ELSE false END WHERE id=$4`,
    [decision, note || null, ctx.me.id, claim.id],
  );
  await audit({ userId: ctx.me.id, entity: 'claim', entityId: claim.id, action: `Decision: ${decision}`, fromStatus: 'Submitted', toStatus: decision, note });
  if (decision === 'Approved') {
    await db.run(`INSERT INTO points_entries (partner_id, kind, points, reason, status) VALUES ($1, 'earn', $2, $3, 'Approved')`, [
      f.partnerId,
      settings().pointsPerApprovedClaim,
      `Approved claim ${claim.code}`,
    ]);
  }
  return respond(f.id, ctx.me);
});

const PaymentBody = z.object({
  reference: z.string().trim().min(1, 'Payment reference is required.').max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.'),
});

campaignRoutes.post('/:fid/claim/payment', auth, role('REVIEWER'), async (ctx) => {
  const { f, claim } = await getCampaign(ctx);
  if (claim.status !== 'Approved') throw conflict('Only approved claims can be paid.');
  if (claim.paidAt) throw conflict('Payment is already recorded.');
  const body = PaymentBody.parse(await ctx.json());
  await db.run('UPDATE claims SET payment_ref=$1, paid_at=$2, paid_by=$3 WHERE id=$4', [body.reference, body.date, ctx.me.id, claim.id]);
  await audit({ userId: ctx.me.id, entity: 'claim', entityId: claim.id, action: 'Payment recorded', note: `${body.reference} · ${body.date}` });
  return respond(f.id, ctx.me);
});
