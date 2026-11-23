import type { IncomingMessage, ServerResponse } from 'http';
import { env } from './env';
import { auth } from './auth';
import { sendJson } from './lib/http';
import { Router } from './lib/router';
import { settings } from './services/settings';
import { authRoutes } from './routes/auth';
import { fundingRoutes } from './routes/funding';
import { campaignRoutes } from './routes/campaigns';
import { kitRoutes } from './routes/kits';
import { enablementRoutes } from './routes/enablement';
import { reviewRoutes } from './routes/reviews';
import { reportRoutes } from './routes/reports';
import { programmeRoutes } from './routes/programme';
import { adminRoutes } from './routes/admin';
import { notificationRoutes } from './routes/notifications';

const api = new Router()
  .get('/api/health', () => ({ ok: true }))
  // Programme limits, for the client to show and pre-check. Any signed-in user.
  .get('/api/settings', auth, () => settings())
  .use('/api/auth', authRoutes)
  .use('/api/funding', fundingRoutes)
  .use('/api/campaigns', campaignRoutes)
  .use('/api/kits', kitRoutes)
  .use('/api/enablement', enablementRoutes)
  .use('/api/reviews', reviewRoutes)
  .use('/api/reports', reportRoutes)
  .use('/api/admin', adminRoutes)
  .use('/api/notifications', notificationRoutes)
  .use('/api', programmeRoutes);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-site',
};

/** The request handler for node:http. No framework: routing, auth and JSON are in src/lib. */
export async function handler(req: IncomingMessage, res: ServerResponse) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

  // CORS: only listed origins may call the API from a browser. The Next.js app calls it server-side.
  const origin = req.headers.origin;
  if (origin && env.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.writeHead(204).end();
    return;
  }
  if (!req.url?.startsWith('/api/')) {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }
  await api.handle(req, res);
}
