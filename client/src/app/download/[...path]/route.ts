import { ApiError, apiRaw } from '@/lib/api';

/**
 * Downloads (evidence files, POE PowerPoint/ZIP, CSV reports, campaign copy).
 * The browser asks this route; it fetches from the backend with the session token
 * and streams the file back, so the token never leaves the server.
 */
const ALLOWED = [/^campaigns\/\d+\/files\/\d+$/, /^campaigns\/\d+\/export$/, /^reports\/export\.csv$/, /^kits\/[a-z0-9-]+\/export$/];

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join('/');
  if (!ALLOWED.some((re) => re.test(path))) return new Response('Not found', { status: 404 });
  const search = new URL(request.url).search;
  try {
    const res = await apiRaw(`/${path}${search}`);
    const headers = new Headers();
    for (const h of ['content-type', 'content-disposition', 'content-length']) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set('cache-control', 'private, no-store');
    return new Response(res.body, { status: 200, headers });
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    if (status === 401) return Response.redirect(new URL('/login', request.url), 303);
    return new Response(e instanceof Error ? e.message : 'Download failed.', { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
