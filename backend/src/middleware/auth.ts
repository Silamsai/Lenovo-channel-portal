import type { RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { prisma } from '../db';
import { HttpError, forbidden } from './errors';

export type Role = 'PARTNER' | 'REVIEWER';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  partnerId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const COOKIE = 'cs_session';
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function setSession(res: Response, userId: number) {
  const token = jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: '8h' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** Loads the signed-in user from the session cookie, or answers 401. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Please sign in.');
  let userId: number;
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    userId = Number(payload.sub);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, 'Please sign in.');
  req.user = { id: user.id, email: user.email, name: user.name, role: user.role as Role, partnerId: user.partnerId };
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };

/** Partners may only touch their own organisation's records. Reviewers see all. */
export function assertPartnerAccess(user: AuthUser, partnerId: number) {
  if (user.role === 'REVIEWER') return;
  if (user.partnerId !== partnerId) throw forbidden();
}

/** Returns the partner id a partner user acts for. */
export function ownPartnerId(user: AuthUser): number {
  if (user.role !== 'PARTNER' || !user.partnerId) throw forbidden('Only partner users can do this.');
  return user.partnerId;
}
