import { z } from 'zod';
import { db } from '../db';
import { auth, ownPartnerId, role } from '../auth';
import { conflict, notFound, sendDownload } from '../lib/http';
import { Router } from '../lib/router';
import { audit } from '../services/audit';
import { brandName } from '../services/poeExport';

export const kitRoutes = new Router();

const kitBySlug = async (slug: string) => {
  const kit = await db.maybe('SELECT * FROM campaign_kits WHERE slug = $1', [slug]);
  if (!kit) throw notFound('Campaign kit not found.');
  return kit;
};

kitRoutes.get('/', auth, () => db.many('SELECT * FROM campaign_kits ORDER BY code'));

kitRoutes.get('/:slug', auth, async (ctx) => {
  const kit = await kitBySlug(ctx.params.slug);
  const partnerId = ctx.me.partnerId;
  const customisation = partnerId
    ? (await db.maybe('SELECT company, contact_email, cta, url, updated_at FROM kit_customisations WHERE kit_id = $1 AND partner_id = $2', [kit.id, partnerId])) ?? null
    : null;
  return { kit, customisation };
});

const CustomBody = z.object({
  company: z.string().trim().min(1, 'Company name is required.').max(55),
  contactEmail: z.string().trim().email('Enter a valid email.'),
  cta: z.enum(['Register for the webinar', 'Book a conversation', 'Learn more']),
  url: z.string().trim().url('Enter a full URL, starting with https://').refine((u) => /^https?:\/\//.test(u), 'Use an http(s) URL.'),
});

kitRoutes.put('/:slug/customisation', auth, role('PARTNER'), async (ctx) => {
  const partnerId = ownPartnerId(ctx.me);
  const kit = await kitBySlug(ctx.params.slug);
  const b = CustomBody.parse(await ctx.json());
  await db.run(
    `INSERT INTO kit_customisations (kit_id, partner_id, company, contact_email, cta, url) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (kit_id, partner_id) DO UPDATE SET company=EXCLUDED.company, contact_email=EXCLUDED.contact_email, cta=EXCLUDED.cta, url=EXCLUDED.url, updated_at=now()`,
    [kit.id, partnerId, b.company, b.contactEmail, b.cta, b.url],
  );
  return { ok: true };
});

/** Exports the customised campaign copy as a text file. Counts towards reporting. */
kitRoutes.get('/:slug/export', auth, role('PARTNER'), async (ctx) => {
  const partnerId = ownPartnerId(ctx.me);
  const kit = await kitBySlug(ctx.params.slug);
  const custom = await db.maybe('SELECT * FROM kit_customisations WHERE kit_id = $1 AND partner_id = $2', [kit.id, partnerId]);
  if (!custom) throw conflict('Save your partner details before exporting.');
  await audit({ userId: ctx.me.id, entity: 'kit', entityId: kit.id, action: 'Exported' });
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
  sendDownload(ctx.res, text, `${kit.slug}-campaign-copy.txt`, 'text/plain; charset=utf-8');
  ctx.sent = true;
});
