import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireRole, type AuthUser } from '../middleware/auth';
import { badRequest, conflict, forbidden, notFound } from '../middleware/errors';
import { MAX_CAMPAIGN_BYTES, filePath, removeStored, upload } from '../middleware/upload';
import { audit, history } from '../services/audit';
import { buildPoePack } from '../services/poeExport';
import { EVIDENCE_KINDS, METRIC_FIELDS, POINTS_PER_APPROVED_CLAIM, isLocked, resultsProblem, round2, type CampaignType } from '../services/rules';
import { serializeFunding } from '../services/serialize';
import { loadFunding } from './funding';

export const campaignsRouter = Router();

/** Loads a funding request that has a started campaign (and its claim). URLs use the funding id. */
async function loadCampaign(req: Request) {
  const f = await loadFunding(Number(req.params.fid), req.user!);
  if (!f.campaign || !f.campaign.claim) throw conflict('This campaign has not been started yet.');
  return { f, c: f.campaign, claim: f.campaign.claim };
}

async function respond(fid: number, user: AuthUser) {
  return serializeFunding(await loadFunding(fid, user));
}

const claimLocked = (status: string) => isLocked(status);

async function unattest(claimId: number) {
  await prisma.claim.update({ where: { id: claimId }, data: { attested: false } });
}

/** Removes just-uploaded files when a request is refused. */
function discardUploads(req: Request) {
  for (const file of (req.files as Express.Multer.File[] | undefined) ?? []) removeStored(file.filename);
}

async function checkCampaignSize(campaignId: number, incoming: Express.Multer.File[]) {
  const agg = await prisma.campaignFile.aggregate({ where: { campaignId }, _sum: { size: true } });
  const total = (agg._sum.size ?? 0) + incoming.reduce((n, f) => n + f.size, 0);
  if (total > MAX_CAMPAIGN_BYTES) throw badRequest('Maximum 100 MB of files per campaign.');
}

// ---------- Detail ----------

campaignsRouter.get('/:fid', async (req, res) => {
  const { f, c, claim } = await loadCampaign(req);
  res.json({
    item: serializeFunding(f),
    history: {
      funding: await history('funding', f.id),
      assets: await history('assets', c.id),
      claim: await history('claim', claim.id),
    },
  });
});

// ---------- Campaign assets (versioned approval) ----------

/** Any change to approved assets starts a new version that needs approval again. */
async function beforeAssetChange(c: { id: number; assetStatus: string; assetVersion: number }, claimStatus: string, userId: number) {
  if (claimLocked(claimStatus)) throw conflict('Assets are locked while the claim is submitted or decided.');
  if (c.assetStatus === 'Submitted') throw conflict('Assets are awaiting review and cannot change until a decision is made.');
  if (c.assetStatus === 'Approved') {
    const note = 'Assets changed after approval. Submit this new version for review.';
    await prisma.campaign.update({ where: { id: c.id }, data: { assetVersion: c.assetVersion + 1, assetStatus: 'Draft', assetNote: note } });
    await audit({ userId, entity: 'assets', entityId: c.id, action: `Version ${c.assetVersion + 1} started`, fromStatus: 'Approved', toStatus: 'Draft', note });
  }
}

campaignsRouter.post('/:fid/assets', requireRole('PARTNER'), upload.array('files', 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  try {
    if (!files.length) throw badRequest('Choose at least one file.');
    const { f, c, claim } = await loadCampaign(req);
    await beforeAssetChange(c, claim.status, req.user!.id);
    await checkCampaignSize(c.id, files);
    await prisma.campaignFile.createMany({
      data: files.map((x) => ({ campaignId: c.id, kind: 'asset', name: x.originalname, storedAs: x.filename, size: x.size, mime: x.mimetype })),
    });
    await unattest(claim.id);
    res.json(await respond(f.id, req.user!));
  } catch (err) {
    discardUploads(req);
    throw err;
  }
});

campaignsRouter.delete('/:fid/assets/:fileId', requireRole('PARTNER'), async (req, res) => {
  const { f, c, claim } = await loadCampaign(req);
  const file = c.files.find((x) => x.id === Number(req.params.fileId) && x.kind === 'asset');
  if (!file) throw notFound('File not found.');
  await beforeAssetChange(c, claim.status, req.user!.id);
  await prisma.campaignFile.delete({ where: { id: file.id } });
  removeStored(file.storedAs);
  await unattest(claim.id);
  res.json(await respond(f.id, req.user!));
});

campaignsRouter.post('/:fid/assets/submit', requireRole('PARTNER'), async (req, res) => {
  const { f, c, claim } = await loadCampaign(req);
  if (claimLocked(claim.status)) throw conflict('Assets are locked with the claim.');
  if (!['Draft', 'Changes requested'].includes(c.assetStatus)) throw conflict(`Assets are already ${c.assetStatus.toLowerCase()}.`);
  if (!c.files.some((x) => x.kind === 'asset')) throw badRequest('Upload at least one campaign asset first.');
  await prisma.campaign.update({ where: { id: c.id }, data: { assetStatus: 'Submitted', assetBy: req.user!.id, assetNote: null } });
  await audit({ userId: req.user!.id, entity: 'assets', entityId: c.id, action: `Version ${c.assetVersion} submitted`, fromStatus: c.assetStatus, toStatus: 'Submitted' });
  res.json(await respond(f.id, req.user!));
});

const Decision = z.object({
  decision: z.enum(['Approved', 'Changes requested', 'Rejected']),
  note: z.string().trim().max(1000).default(''),
});

campaignsRouter.post('/:fid/assets/decision', requireRole('REVIEWER'), async (req, res) => {
  const { f, c } = await loadCampaign(req);
  const { decision, note } = Decision.parse(req.body);
  if (decision === 'Rejected') throw badRequest('Assets can be approved or sent back for changes.');
  if (c.assetStatus !== 'Submitted') throw conflict('Only submitted assets can be reviewed.');
  if (c.assetBy === req.user!.id) throw forbidden('You cannot review assets you submitted.');
  if (decision !== 'Approved' && !note) throw badRequest('Tell the partner what to change.');
  await prisma.campaign.update({ where: { id: c.id }, data: { assetStatus: decision, assetNote: note || null } });
  await audit({ userId: req.user!.id, entity: 'assets', entityId: c.id, action: `Version ${c.assetVersion}: ${decision}`, fromStatus: 'Submitted', toStatus: decision, note });
  res.json(await respond(f.id, req.user!));
});

// ---------- Performance ----------

const PerformanceBody = z.object({
  metrics: z.record(z.union([z.number(), z.string()])),
  spend: z.union([z.number(), z.string()]),
  complete: z.boolean().default(false),
});

campaignsRouter.put('/:fid/performance', requireRole('PARTNER'), async (req, res) => {
  const { f, c, claim } = await loadCampaign(req);
  if (claimLocked(claim.status)) throw conflict('Performance is locked with the submitted claim.');
  const body = PerformanceBody.parse(req.body);
  const problem = resultsProblem(f.type, body.metrics, body.spend);
  if (problem) throw badRequest(problem);
  const keys = METRIC_FIELDS[f.type as CampaignType].map(([k]) => k);
  const metrics = Object.fromEntries(keys.map((k) => [k, Number(body.metrics[k])]));
  await prisma.campaign.update({
    where: { id: c.id },
    data: {
      metrics: JSON.stringify(metrics),
      actualSpend: round2(Number(body.spend)),
      completedAt: body.complete ? c.completedAt ?? new Date() : null,
    },
  });
  await unattest(claim.id);
  res.json(await respond(f.id, req.user!));
});

// ---------- Evidence ----------

campaignsRouter.post('/:fid/evidence/:kind', requireRole('PARTNER'), upload.array('files', 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  try {
    const kind = String(req.params.kind);
    if (!(EVIDENCE_KINDS as readonly string[]).includes(kind)) throw badRequest('Unknown evidence category.');
    if (!files.length) throw badRequest('Choose at least one file.');
    const { f, c, claim } = await loadCampaign(req);
    if (claimLocked(claim.status)) throw conflict('Evidence is locked with the submitted claim.');
    await checkCampaignSize(c.id, files);
    await prisma.campaignFile.createMany({
      data: files.map((x) => ({ campaignId: c.id, kind, name: x.originalname, storedAs: x.filename, size: x.size, mime: x.mimetype })),
    });
    await unattest(claim.id);
    res.json(await respond(f.id, req.user!));
  } catch (err) {
    discardUploads(req);
    throw err;
  }
});

campaignsRouter.delete('/:fid/evidence/:fileId', requireRole('PARTNER'), async (req, res) => {
  const { f, c, claim } = await loadCampaign(req);
  if (claimLocked(claim.status)) throw conflict('Evidence is locked with the submitted claim.');
  const file = c.files.find((x) => x.id === Number(req.params.fileId) && x.kind !== 'asset');
  if (!file) throw notFound('File not found.');
  await prisma.campaignFile.delete({ where: { id: file.id } });
  removeStored(file.storedAs);
  await unattest(claim.id);
  res.json(await respond(f.id, req.user!));
});

// ---------- Files and export ----------

campaignsRouter.get('/:fid/files/:fileId', async (req, res) => {
  const { c } = await loadCampaign(req);
  const file = c.files.find((x) => x.id === Number(req.params.fileId));
  if (!file) throw notFound('File not found.');
  res.download(filePath(file.storedAs), file.name);
});

campaignsRouter.get('/:fid/export', async (req, res) => {
  const { f, c, claim } = await loadCampaign(req);
  const type = req.query.type === 'zip' ? 'zip' : 'pptx';
  const buffer = await buildPoePack(serializeFunding(f), c.files, type);
  res.setHeader(
    'Content-Type',
    type === 'zip' ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${claim.code}-POE.${type}"`);
  res.send(buffer);
});

// ---------- Claim ----------

const ClaimBody = z.object({
  amount: z.number().positive('Claim must be greater than zero.'),
  attested: z.boolean(),
  submit: z.boolean().default(false),
});

campaignsRouter.put('/:fid/claim', requireRole('PARTNER'), async (req, res) => {
  const { f, claim } = await loadCampaign(req);
  if (claimLocked(claim.status)) throw conflict(`Claim ${claim.code} is ${claim.status.toLowerCase()}.`);
  const body = ClaimBody.parse(req.body);
  const item = serializeFunding(f);
  const c = item.campaign!;
  if (body.submit) {
    const problem = !c.assetsApproved
      ? 'The current campaign asset version must be approved.'
      : !c.resultsReady
        ? 'Complete all mandatory campaign performance metrics.'
        : !c.evidenceComplete
          ? 'Attach delivery evidence, a performance report and invoices.'
          : body.amount > c.claim!.limit
            ? `Claim must be within £${c.claim!.limit.toLocaleString('en-GB')} (50% of eligible spend, capped at approved funding).`
            : !body.attested
              ? 'Confirm the claim declaration.'
              : '';
    if (problem) throw badRequest(problem);
  } else if (body.amount > c.claim!.limit) {
    throw badRequest(`Claim must be within £${c.claim!.limit.toLocaleString('en-GB')}.`);
  }
  await prisma.claim.update({
    where: { id: claim.id },
    data: {
      amount: round2(body.amount),
      attested: body.attested,
      ...(body.submit ? { status: 'Submitted', submittedBy: req.user!.id, submittedAt: new Date(), note: null } : {}),
    },
  });
  if (body.submit)
    await audit({ userId: req.user!.id, entity: 'claim', entityId: claim.id, action: 'Claim submitted', fromStatus: claim.status, toStatus: 'Submitted' });
  res.json(await respond(f.id, req.user!));
});

campaignsRouter.post('/:fid/claim/decision', requireRole('REVIEWER'), async (req, res) => {
  const { f, claim } = await loadCampaign(req);
  const { decision, note } = Decision.parse(req.body);
  if (claim.status !== 'Submitted') throw conflict('Only submitted claims can be reviewed.');
  if (claim.submittedBy === req.user!.id) throw forbidden('You cannot decide a claim you submitted.');
  if (decision !== 'Approved' && !note) throw badRequest('Give the partner a reason.');
  await prisma.claim.update({
    where: { id: claim.id },
    data: { status: decision, note: note || null, decidedBy: req.user!.id, decidedAt: new Date(), ...(decision === 'Approved' ? {} : { attested: false }) },
  });
  await audit({ userId: req.user!.id, entity: 'claim', entityId: claim.id, action: `Decision: ${decision}`, fromStatus: 'Submitted', toStatus: decision, note });
  if (decision === 'Approved') {
    await prisma.pointsEntry.create({
      data: { partnerId: f.partnerId, kind: 'earn', points: POINTS_PER_APPROVED_CLAIM, reason: `Approved claim ${claim.code}`, status: 'Approved' },
    });
  }
  res.json(await respond(f.id, req.user!));
});

const PaymentBody = z.object({
  reference: z.string().trim().min(1, 'Payment reference is required.').max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.'),
});

campaignsRouter.post('/:fid/claim/payment', requireRole('REVIEWER'), async (req, res) => {
  const { f, claim } = await loadCampaign(req);
  if (claim.status !== 'Approved') throw conflict('Only approved claims can be paid.');
  if (claim.paidAt) throw conflict('Payment is already recorded.');
  const body = PaymentBody.parse(req.body);
  await prisma.claim.update({ where: { id: claim.id }, data: { paymentRef: body.reference, paidAt: body.date, paidBy: req.user!.id } });
  await audit({ userId: req.user!.id, entity: 'claim', entityId: claim.id, action: 'Payment recorded', note: `${body.reference} · ${body.date}` });
  res.json(await respond(f.id, req.user!));
});
