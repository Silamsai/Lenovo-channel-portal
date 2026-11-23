import dotenv from 'dotenv';
import path from 'path';

// Explicitly load backend/.env, then fall back to repo root / cwd .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

export const env = {
  isProd,
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  /** PostgreSQL connection string (Neon). Required. */
  databaseUrl: process.env.DATABASE_URL || '',
  uploadDir: path.resolve(__dirname, '../uploads'),
  /** Origins allowed to call the API from a browser (the Next.js app calls it server-side). */
  allowedOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim()),
};
