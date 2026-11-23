import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db';
import { clearSession, requireAuth, setSession } from '../middleware/auth';
import { HttpError } from '../middleware/errors';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
});

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

async function publicUser(id: number) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, include: { partner: true } });
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    partner: u.partner ? { id: u.partner.id, name: u.partner.name, code: u.partner.code, segment: u.partner.segment } : null,
  };
}

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  const fail = new HttpError(401, 'Email or password not recognised.');
  if (!parsed.success) throw fail;
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Compare against a dummy hash when the user is unknown, so timing does not reveal which emails exist.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(parsed.data.password, hash);
  if (!user || !ok) throw fail;
  setSession(res, user.id);
  res.json(await publicUser(user.id));
});

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await publicUser(req.user!.id));
});
