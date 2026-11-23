import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../env';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_CAMPAIGN_BYTES = 100 * 1024 * 1024;

fs.mkdirSync(env.uploadDir, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, env.uploadDir),
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).slice(0, 12)),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 20 },
});

export function filePath(storedAs: string) {
  return path.join(env.uploadDir, path.basename(storedAs));
}

export function removeStored(storedAs: string) {
  fs.rm(filePath(storedAs), { force: true }, () => undefined);
}
