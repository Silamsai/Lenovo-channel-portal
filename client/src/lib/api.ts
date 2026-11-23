/**
 * Server-side access to the backend API. Only used in Server Components, Server Actions
 * and Route Handlers: the session token never reaches browser JavaScript.
 */
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const API_URL = process.env.API_URL || 'http://localhost:4000/api';
export const SESSION_COOKIE = 'cs_token';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

async function request(method: string, path: string, body?: unknown | FormData) {
  const token = await sessionToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: payload, cache: 'no-store' });
  } catch {
    throw new ApiError(503, 'The backend API is not reachable. Is it running?');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

/** Reads data for a page. Signed out → login page; missing → 404 page. */
export async function apiGet<T>(path: string): Promise<T> {
  try {
    return (await (await request('GET', path)).json()) as T;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect('/login');
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

/** Sends a change. Throws ApiError with the backend's message on failure. */
export async function apiSend<T = unknown>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown | FormData): Promise<T> {
  const res = await request(method, path, body);
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? await res.json() : undefined) as T;
}

/** Raw response, for streaming downloads through Next.js. */
export function apiRaw(path: string) {
  return request('GET', path);
}
