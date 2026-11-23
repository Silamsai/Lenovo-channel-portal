import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../env';
import { badRequest } from '../lib/http';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_CAMPAIGN_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 20;

fs.mkdirSync(env.uploadDir, { recursive: true });

export const filePath = (storedAs: string) => path.join(env.uploadDir, path.basename(storedAs));

export function removeStored(storedAs: string) {
  fs.rm(filePath(storedAs), { force: true }, () => undefined);
}

export interface Saved {
  name: string;
  storedAs: string;
  size: number;
  mime: string;
}

/** Takes the "files" entries from a multipart form, checks limits and writes them to the upload folder. */
export async function saveUploads(form: FormData): Promise<Saved[]> {
  const files = form.getAll('files').filter((f): f is File => typeof f !== 'string' && f.size > 0);
  if (!files.length) throw badRequest('Choose at least one file.');
  if (files.length > MAX_FILES) throw badRequest(`Upload at most ${MAX_FILES} files at once.`);
  if (files.some((f) => f.size > MAX_FILE_BYTES)) throw badRequest('Maximum 25 MB per file.');
  const saved: Saved[] = [];
  for (const f of files) {
    const storedAs = crypto.randomUUID() + path.extname(f.name).slice(0, 12).replace(/[^.a-zA-Z0-9]/g, '');
    await fs.promises.writeFile(filePath(storedAs), Buffer.from(await f.arrayBuffer()));
    saved.push({ name: f.name.slice(0, 200), storedAs, size: f.size, mime: f.type || 'application/octet-stream' });
  }
  return saved;
}
