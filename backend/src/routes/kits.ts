import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { ownPartnerId, requireRole } from '../middleware/auth';
import { conflict, notFound } from '../middleware/errors';
import { audit } from '../services/audit';
import { brandName } from '../services/brand';

export const kitsRouter = Router();

const kitOut = (k: Awaited<ReturnType<typeof prisma.campaignKit.findFirstOrThrow>>) => ({
  ...k,
  assets: JSON.parse(k.assets) as { name: string; detail: string; customisable: boolean }[],
});

kitsRouter.get('/', async (_req, res) => {
  const kits = await prisma.campaignKit.findMany({ orderBy: { code: 'asc' } });
  res.json(kits.map(kitOut));
});

kitsRouter.get('/:slug', async (req, res) => {
  const kit = await prisma.campaignKit.findUnique({ where: { slug: String(req.params.slug) } });
  if (!kit) throw notFound('Campaign kit not found.');
  const partnerId = req.user!.partnerId;
  const customisation = partnerId
    ? await prisma.kitCustomisation.findUnique({ where: { kitId_partnerId: { kitId: kit.id, partnerId } } })
    : null;
  res.json({ kit: kitOut(kit), customisation });
});

const CustomBody = z.object({
  company: z.string().trim().min(1, 'Company name is required.').max(55),
  contactEmail: z.string().trim().email('Enter a valid email.'),
  cta: z.enum(['Register for the webinar', 'Book a conversation', 'Learn more']),
  url: z.string().trim().url('Enter a full URL, starting with https://').refine((u) => /^https?:\/\//.test(u), 'Use an http(s) URL.'),
});

kitsRouter.put('/:slug/customisation', requireRole('PARTNER'), async (req, res) => {
  const partnerId = ownPartnerId(req.user!);
  const kit = await prisma.campaignKit.findUnique({ where: { slug: String(req.params.slug) } });
  if (!kit) throw notFound('Campaign kit not found.');
  const body = CustomBody.parse(req.body);
  const saved = await prisma.kitCustomisation.upsert({
    where: { kitId_partnerId: { kitId: kit.id, partnerId } },
    create: { ...body, kitId: kit.id, partnerId },
    update: body,
  });
  res.json(saved);
});

/** Exports the customised campaign copy as a text file. Counts towards reporting. */
kitsRouter.get('/:slug/export', requireRole('PARTNER'), async (req, res) => {
  const partnerId = ownPartnerId(req.user!);
  const kit = await prisma.campaignKit.findUnique({ where: { slug: String(req.params.slug) } });
  if (!kit) throw notFound('Campaign kit not found.');
  const custom = await prisma.kitCustomisation.findUnique({ where: { kitId_partnerId: { kitId: kit.id, partnerId } } });
  if (!custom) throw conflict('Save your partner details before exporting.');
  await audit({ userId: req.user!.id, entity: 'kit', entityId: kit.id, action: 'Exported' });
  const text = [
    `${brandName.toUpperCase()} CAMPAIGN COPY`,
    kit.title,
    '',
    `Partner: ${custom.company}`,
    `Contact: ${custom.contactEmail}`,
    `Call to action: ${custom.cta}`,
    `Link: ${custom.url}`,
    '',
    kit.description,
    '',
    `Approved source kit · Version ${kit.version} · Valid until ${kit.expiry}`,
  ].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${kit.slug}-campaign-copy.txt"`);
  res.send(text);
});
