import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg = 'Please sign in.') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have permission to do this.') => new HttpError(403, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

const JSON_LIMIT = 1024 * 1024; // 1 MB
export const FORM_LIMIT = 120 * 1024 * 1024; // multipart uploads (files are checked individually too)

export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > JSON_LIMIT) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk as Buffer);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw badRequest('Invalid JSON body.');
  }
}

/** Parses multipart/form-data using the built-in Web Request parser (no extra library). */
export async function readForm(req: IncomingMessage): Promise<FormData> {
  const length = Number(req.headers['content-length'] || 0);
  if (length > FORM_LIMIT) throw new HttpError(413, 'Upload is too large.');
  if (!String(req.headers['content-type'] || '').startsWith('multipart/form-data')) throw badRequest('Expected a file upload.');
  const request = new Request('http://local' + (req.url || '/'), {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: Readable.toWeb(req) as unknown as BodyInit,
    duplex: 'half',
  } as RequestInit);
  return request.formData();
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

export function sendError(res: ServerResponse, err: unknown) {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue?.path.join('.');
    return sendJson(res, 400, { error: field ? `${field}: ${issue.message}` : issue?.message ?? 'Invalid input.' });
  }
  console.error(err);
  sendJson(res, 500, { error: 'Something went wrong. Please try again.' });
}

/** Sends a file or generated document as a download. */
export function sendDownload(res: ServerResponse, body: Buffer | string, filename: string, type: string) {
  const data = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  const safe = filename.replace(/["\r\n]/g, '_');
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Content-Disposition': `attachment; filename="${safe.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
  });
  res.end(data);
}
