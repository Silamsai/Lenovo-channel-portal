import jwt from 'jsonwebtoken';
import { db } from './db';
import { env } from './env';
import { forbidden, parseCookies, unauthorized } from './lib/http';
import type { Ctx, Step } from './lib/router';

export type Role = 'PARTNER' | 'REVIEWER' | 'ADMIN';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  partnerId: number | null;
}

export const COOKIE = 'cs_session';
export const SESSION_SECONDS = 8 * 60 * 60;

export const signToken = (userId: number) => jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: SESSION_SECONDS });

/** Reads the session from `Authorization: Bearer <token>` (Next.js server) or the session cookie. */
function tokenOf(ctx: Ctx) {
  const header = ctx.req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return parseCookies(ctx.req.headers.cookie)[COOKIE];
}

/** Loads the signed-in user, or answers 401. */
export const auth: Step = async (ctx) => {
  const token = tokenOf(ctx);
  if (!token) throw unauthorized();
  let userId: number;
  try {
    userId = Number((jwt.verify(token, env.jwtSecret) as jwt.JwtPayload).sub);
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }
  const user = await db.maybe('SELECT id, email, name, role, partner_id, active FROM users WHERE id = $1', [userId]);
  if (!user) throw unauthorized();
  if (!user.active) throw unauthorized('This account has been deactivated.');
  ctx.user = { id: user.id, email: user.email, name: user.name, role: user.role, partnerId: user.partnerId };
};

export const role =
  (...roles: Role[]): Step =>
  (ctx) => {
    if (!ctx.user || !roles.includes(ctx.user.role)) throw forbidden();
  };

/** Partners may only touch their own organisation's records. Reviewers and admins see all. */
export function assertPartnerAccess(user: AuthUser, partnerId: number) {
  if (user.role === 'REVIEWER' || user.role === 'ADMIN') return;
  if (user.partnerId !== partnerId) throw forbidden();
}

export function ownPartnerId(user: AuthUser): number {
  if (user.role !== 'PARTNER' || !user.partnerId) throw forbidden('Only partner users can do this.');
  return user.partnerId;
}
