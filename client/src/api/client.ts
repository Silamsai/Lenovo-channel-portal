export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) {
    const type = res.headers.get('content-type') ?? '';
    return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>;
  }
  let message = `Request failed (${res.status}).`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    /* not JSON */
  }
  throw new ApiError(res.status, message);
}

/** JSON request to the API. Cookies carry the session. */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    credentials: 'include',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return handle<T>(res);
}

/** Multipart upload of one or more files under the field name "files". */
export async function uploadFiles<T>(path: string, files: FileList | File[]): Promise<T> {
  const form = new FormData();
  for (const f of Array.from(files)) form.append('files', f);
  const res = await fetch('/api' + path, { method: 'POST', credentials: 'include', body: form });
  return handle<T>(res);
}

/** Downloads a file from the API (keeps the session cookie) and saves it. */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await fetch('/api' + path, { credentials: 'include' });
  if (!res.ok) await handle(res);
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
