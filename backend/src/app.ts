import express from 'express';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errors';
import { authRouter } from './routes/auth';
import { fundingRouter } from './routes/funding';
import { campaignsRouter } from './routes/campaigns';
import { kitsRouter } from './routes/kits';
import { enablementRouter } from './routes/enablement';
import { reviewsRouter } from './routes/reviews';
import { reportsRouter } from './routes/reports';
import { programmeRouter } from './routes/programme';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);

  // Everything below needs a signed-in user.
  const api = express.Router();
  api.use(requireAuth);
  api.use('/funding', fundingRouter);
  api.use('/campaigns', campaignsRouter);
  api.use('/kits', kitsRouter);
  api.use('/enablement', enablementRouter);
  api.use('/reviews', reviewsRouter);
  api.use('/reports', reportsRouter);
  api.use('/', programmeRouter);
  app.use('/api', api);
  app.use('/api', () => {
    throw notFound('Unknown API route.');
  });

  // In production, serve the built client from the same origin.
  if (fs.existsSync(env.clientDist)) {
    app.use(express.static(env.clientDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(env.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
