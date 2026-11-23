import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db';
import { COOKIE, SESSION_SECONDS, auth, signToken } from '../auth';
import { env } from '../env';
import { HttpError } from '../lib/http';
import { Router, type Ctx } from '../lib/router';
import { audit } from '../services/audit';

export const authRoutes = new Router();

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Simple in-memory rate limit for sign-in: 20 attempts per 15 minutes per IP.
const attempts = new Map<string, { count: number; reset: number }>();
function rateLimit(ctx: Ctx) {
  const ip = String(ctx.req.headers['x-forwarded-for'] || ctx.req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 15 * 60 * 1000 });
    return;
  }
  entry.count++;
  if (entry.count > 20) throw new HttpError(429, 'Too many sign-in attempts. Try again in a few minutes.');
}

export async function publicUser(id: number) {
  const u = await db.one(
    `SELECT u.id, u.email, u.name, u.role, p.id AS partner_id, p.name AS partner_name, p.code AS partner_code, p.segment AS partner_segment
       FROM users u LEFT JOIN partners p ON p.id = u.partner_id WHERE u.id = $1`,
    [id],
  );
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    partner: u.partnerId ? { id: u.partnerId, name: u.partnerName, code: u.partnerCode, segment: u.partnerSegment } : null,
  };
}

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

authRoutes.post('/login', async (ctx) => {
  rateLimit(ctx);
  const parsed = LoginBody.safeParse(await ctx.json());
  const fail = new HttpError(401, 'Email or password not recognised.');
  if (!parsed.success) throw fail;
  const user = await db.maybe('SELECT id, password_hash, active FROM users WHERE email = $1', [parsed.data.email]);
  // Compare against a dummy hash when the email is unknown, so timing does not reveal which emails exist.
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw fail;
  if (!user.active) throw new HttpError(403, 'This account has been deactivated. Contact your platform administrator.');
  await db.run('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  const token = signToken(user.id);
  // The Next.js app stores the token in its own cookie; the cookie here helps direct API use and tests.
  ctx.res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${env.isProd ? '; Secure' : ''}`,
  );
  return { user: await publicUser(user.id), token, expiresIn: SESSION_SECONDS };
});

authRoutes.post('/logout', (ctx) => {
  ctx.res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return { ok: true };
});

authRoutes.get('/me', auth, (ctx) => publicUser(ctx.me.id));

const PasswordBody = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(200),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(200),
});

/** Signed-in users change their own password (current password required). */
authRoutes.post('/password', auth, async (ctx) => {
  rateLimit(ctx);
  const body = PasswordBody.parse(await ctx.json());
  const user = await db.one('SELECT password_hash FROM users WHERE id = $1', [ctx.me.id]);
  if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is not correct.');
  if (body.currentPassword === body.newPassword) throw new HttpError(400, 'Choose a new password that is different from the current one.');
  await db.run('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(body.newPassword, 10), ctx.me.id]);
  await audit({ userId: ctx.me.id, entity: 'user', entityId: ctx.me.id, action: 'Password changed', note: ctx.me.email });
  return { ok: true };
});
