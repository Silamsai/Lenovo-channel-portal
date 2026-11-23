import 'dotenv/config';
import path from 'path';

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
