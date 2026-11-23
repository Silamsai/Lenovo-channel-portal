import fs from 'fs/promises';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { filePath } from '../middleware/upload';
import { EVIDENCE_KINDS, EVIDENCE_LABELS } from './rules';
import type { FundingOut } from './serialize';
import { brandName } from './brand';

const gbp = (n: number | null | undefined) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

type Stored = { id: number; storedAs: string };

/** Builds the proof-of-execution PowerPoint, and optionally a ZIP with every evidence file. */
export async function buildPoePack(item: FundingOut, stored: Stored[], type: 'pptx' | 'zip') {
  const c = item.campaign!;
  const claim = c.claim!;
  const ppt = new PptxGenJS();
  ppt.layout = 'LAYOUT_WIDE';
  ppt.title = `${claim.code} · Proof of execution`;

  const slide = (title: string, lines: string[]) => {
    const s = ppt.addSlide();
    s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.18, fill: { color: 'E2231A' } });
    s.addText(`${brandName} | CHANNEL STUDIO`, { x: 0.6, y: 0.35, w: 12, h: 0.4, fontSize: 12, color: 'B91C14', bold: true });
    s.addText(title, { x: 0.6, y: 0.9, w: 12, h: 0.9, fontSize: 28, bold: true, color: '1A1A1A' });
    s.addText(lines.join('\n'), { x: 0.6, y: 2.0, w: 12, h: 4.8, fontSize: 18, color: '333333', valign: 'top', fit: 'shrink' });
  };

  slide(item.title, [
    `${item.partner.name} · ${item.code} · ${item.quarter.replace(/(\d{4})-Q(\d)/, 'Q$2 $1')}`,
    `${item.type} · executed ${item.date}`,
    `Claim ${claim.code} · ${claim.status}`,
    `Approved allocation: ${gbp(item.amount)}`,
    `Actual eligible spend: ${gbp(c.actualSpend)}`,
    `Claim amount: ${gbp(claim.amount ?? claim.limit)}`,
  ]);
  slide(
    'Campaign performance',
    c.metricFields.length && c.resultsReady
      ? [...c.metricFields.map(([k, label]) => `${label}: ${c.metrics[k]}`), `Actual eligible spend: ${gbp(c.actualSpend)}`]
      : ['Performance not yet recorded.'],
  );
  slide('Campaign asset approval', [
    `Version ${c.assetVersion} · ${c.assetStatus}`,
    ...c.assets.map((f) => `• ${f.name}`),
    c.assetNote ? `Reviewer note: ${c.assetNote}` : '',
  ]);
  slide('POE checklist', [
    `Approved campaign assets: ${c.assets.length} file(s)`,
    ...EVIDENCE_KINDS.map((k) => `${EVIDENCE_LABELS[k]}: ${c.evidence[k].length} file(s)`),
  ]);
  const index = [
    ...c.assets.map((f) => `Campaign asset: ${f.name}`),
    ...EVIDENCE_KINDS.flatMap((k) => c.evidence[k].map((f) => `${EVIDENCE_LABELS[k]}: ${f.name}`)),
  ];
  for (let i = 0; i < index.length; i += 10) slide('Evidence index', index.slice(i, i + 10));

  const pptBuffer = (await ppt.write({ outputType: 'nodebuffer' })) as Buffer;
  if (type === 'pptx') return pptBuffer;

  const zip = new JSZip();
  zip.file(`${claim.code}-POE.pptx`, pptBuffer);
  const storedById = new Map(stored.map((s) => [s.id, s.storedAs]));
  const groups: [string, typeof c.assets][] = [
    ['0-campaign-assets', c.assets],
    ...EVIDENCE_KINDS.map((k, i) => [`${i + 1}-${k}`, c.evidence[k]] as [string, typeof c.assets]),
  ];
  const manifest: { name: string; path: string; category: string; bytes: number }[] = [];
  for (const [folder, files] of groups) {
    for (const [j, f] of files.entries()) {
      const storedAs = storedById.get(f.id);
      if (!storedAs) continue;
      const safe = f.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 160);
      const path = `evidence/${folder}/${j + 1}-${safe}`;
      zip.file(path, await fs.readFile(filePath(storedAs)));
      manifest.push({ name: f.name, path, category: folder, bytes: f.size });
    }
  }
  zip.file(
    'claim-and-performance.json',
    JSON.stringify(
      {
        funding: { code: item.code, title: item.title, quarter: item.quarter, date: item.date, type: item.type, amount: item.amount },
        partner: item.partner,
        claim: { code: claim.code, status: claim.status, amount: claim.amount ?? claim.limit, currency: 'GBP' },
        metrics: c.metrics,
        actualSpend: c.actualSpend,
        assets: { status: c.assetStatus, version: c.assetVersion, note: c.assetNote },
        files: manifest,
      },
      null,
      2,
    ),
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}
