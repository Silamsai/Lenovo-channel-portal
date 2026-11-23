import dotenv from 'dotenv';
import path from 'path';

// Explicitly load backend/.env, then fall back to repo root / cwd .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Ensure DATABASE_URL is set as a fallback for SQLite dev database
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.resolve(__dirname, '../prisma/dev.db')}`;
}

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

export const env = {
  isProd,
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  uploadDir: path.resolve(__dirname, '../uploads'),
  clientDist: path.resolve(__dirname, '../../client/dist'),
};
