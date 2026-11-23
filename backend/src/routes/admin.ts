import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db';
import { auth, role } from '../auth';
import { badRequest, conflict, notFound } from '../lib/http';
import { Router } from '../lib/router';
import { audit } from '../services/audit';
import { round2 } from '../services/rules';
import { DEFAULT_SETTINGS, saveSettings, settings } from '../services/settings';

/** Platform administration: users, partner organisations and programme settings. */
export const adminRoutes = new Router();
const admin = [auth, role('ADMIN')] as const;

const ROLES = ['PARTNER', 'REVIEWER', 'ADMIN'] as const;
const password = z.string().min(8, 'Password must be at least 8 characters.').max(200);

const activeAdmins = async (excludeId: number) =>
  (await db.one(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'ADMIN' AND active AND id <> $1`, [excludeId])).n as number;

/** Partner users must belong to an organisation; staff users must not. */
async function partnerLink(roleName: string, partnerId: number | null | undefined) {
  if (roleName !== 'PARTNER') return null;
  if (!partnerId) throw badRequest('Choose the partner organisation for this user.');
  if (!(await db.maybe('SELECT id FROM partners WHERE id = $1', [partnerId]))) throw badRequest('Unknown partner organisation.');
  return partnerId;
}

// ---------- Overview ----------

adminRoutes.get('/overview', ...admin, async () => {
  const [users, partners, funding, claims, recent] = await Promise.all([
    db.one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active, COUNT(*) FILTER (WHERE NOT active)::int AS inactive,
                   COUNT(*) FILTER (WHERE role = 'PARTNER')::int AS partner, COUNT(*) FILTER (WHERE role = 'REVIEWER')::int AS reviewer,
                   COUNT(*) FILTER (WHERE role = 'ADMIN')::int AS admin,
                   COUNT(*) FILTER (WHERE last_login_at > now() - interval '7 days')::int AS active_this_week
              FROM users`),
    db.one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'Active')::int AS active FROM partners`),
    db.one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'Submitted')::int AS submitted,
                   COALESCE(SUM(amount) FILTER (WHERE status = 'Approved'), 0) AS approved_amount FROM funding_requests`),
    db.one(`SELECT COUNT(*) FILTER (WHERE status = 'Submitted')::int AS submitted,
                   COALESCE(SUM(amount) FILTER (WHERE status = 'Approved'), 0) AS approved_amount,
                   COALESCE(SUM(amount) FILTER (WHERE paid_at IS NOT NULL), 0) AS paid_amount FROM claims`),
    db.many(`SELECT a.id, a.entity, a.action, a.note, a.created_at,
                    COALESCE(u.name, CASE WHEN a.user_id IS NULL THEN 'System' ELSE 'Deleted user' END) AS by
               FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC, a.id DESC LIMIT 12`),
  ]);
  return {
    users: {
      total: users.total,
      active: users.active,
      inactive: users.inactive,
      byRole: { PARTNER: users.partner, REVIEWER: users.reviewer, ADMIN: users.admin },
      activeThisWeek: users.activeThisWeek,
    },
    partners: { total: partners.total, active: partners.active, invited: partners.total - partners.active },
    funding: { total: funding.total, submitted: funding.submitted, approvedAmount: round2(Number(funding.approvedAmount)) },
    claims: { submitted: claims.submitted, approvedAmount: round2(Number(claims.approvedAmount)), paidAmount: round2(Number(claims.paidAmount)) },
    recent,
  };
});

// ---------- Users ----------

const USER_SELECT = `SELECT u.id, u.name, u.email, u.role, u.active, u.last_login_at, u.created_at,
                            p.id AS partner_id, p.name AS partner_name, p.code AS partner_code
                       FROM users u LEFT JOIN partners p ON p.id = u.partner_id`;
const userOut = (u: Record<string, any>) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  partner: u.partnerId ? { id: u.partnerId, name: u.partnerName, code: u.partnerCode } : null,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});

adminRoutes.get('/users', ...admin, async () => (await db.many(`${USER_SELECT} ORDER BY u.role, u.name`)).map(userOut));

adminRoutes.get('/users/:id', ...admin, async (ctx) => {
  const u = await db.maybe(`${USER_SELECT} WHERE u.id = $1`, [ctx.param('id')]);
  if (!u) throw notFound('User not found.');
  return userOut(u);
});

const NewUser = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
  role: z.enum(ROLES),
  partnerId: z.number().int().nullable().optional(),
  password,
});

adminRoutes.post('/users', ...admin, async (ctx) => {
  const b = NewUser.parse(await ctx.json());
  if (await db.maybe('SELECT id FROM users WHERE email = $1', [b.email])) throw conflict('A user with this email already exists.');
  const partnerId = await partnerLink(b.role, b.partnerId);
  const user = await db.one('INSERT INTO users (name, email, role, partner_id, password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id', [
    b.name,
    b.email,
    b.role,
    partnerId,
    await bcrypt.hash(b.password, 10),
  ]);
  await audit({ userId: ctx.me.id, entity: 'user', entityId: user.id, action: `User created (${b.role})`, note: b.email });
  ctx.status = 201;
  return { id: user.id };
});

const EditUser = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
  role: z.enum(ROLES),
  partnerId: z.number().int().nullable().optional(),
  active: z.boolean(),
});

adminRoutes.put('/users/:id', ...admin, async (ctx) => {
  const id = ctx.param('id');
  const existing = await db.maybe('SELECT id, role, active FROM users WHERE id = $1', [id]);
  if (!existing) throw notFound('User not found.');
  const b = EditUser.parse(await ctx.json());
  const clash = await db.maybe('SELECT id FROM users WHERE email = $1', [b.email]);
  if (clash && clash.id !== id) throw conflict('A user with this email already exists.');
  if (id === ctx.me.id && (!b.active || b.role !== 'ADMIN')) throw badRequest('You cannot deactivate or demote your own account.');
  if (existing.role === 'ADMIN' && (b.role !== 'ADMIN' || !b.active) && (await activeAdmins(id)) === 0) throw badRequest('At least one active platform admin is required.');
  const partnerId = await partnerLink(b.role, b.partnerId);
  await db.run('UPDATE users SET name=$1, email=$2, role=$3, active=$4, partner_id=$5 WHERE id=$6', [b.name, b.email, b.role, b.active, partnerId, id]);
  await audit({
    userId: ctx.me.id,
    entity: 'user',
    entityId: id,
    action: existing.active !== b.active ? (b.active ? 'User reactivated' : 'User deactivated') : 'User updated',
    note: b.email,
  });
  return { ok: true };
});

adminRoutes.post('/users/:id/password', ...admin, async (ctx) => {
  const id = ctx.param('id');
  const user = await db.maybe('SELECT email FROM users WHERE id = $1', [id]);
  if (!user) throw notFound('User not found.');
  const b = z.object({ password }).parse(await ctx.json());
  await db.run('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(b.password, 10), id]);
  await audit({ userId: ctx.me.id, entity: 'user', entityId: id, action: 'Password reset', note: user.email });
  return { ok: true };
});

adminRoutes.delete('/users/:id', ...admin, async (ctx) => {
  const id = ctx.param('id');
  const user = await db.maybe('SELECT email, role, active FROM users WHERE id = $1', [id]);
  if (!user) throw notFound('User not found.');
  if (id === ctx.me.id) throw badRequest('You cannot delete your own account.');
  if (user.role === 'ADMIN' && user.active && (await activeAdmins(id)) === 0) throw badRequest('At least one active platform admin is required.');
  await db.run('DELETE FROM users WHERE id = $1', [id]);
  await audit({ userId: ctx.me.id, entity: 'user', entityId: id, action: 'User deleted', note: user.email });
  return { ok: true };
});

// ---------- Partner organisations ----------

adminRoutes.get('/partners', ...admin, () =>
  db.many(
    `SELECT p.*, (SELECT COUNT(*) FROM users u WHERE u.partner_id = p.id)::int AS user_count,
            (SELECT COUNT(*) FROM funding_requests f WHERE f.partner_id = p.id)::int AS funding_count
       FROM partners p ORDER BY p.code`,
  ),
);

adminRoutes.get('/partners/:id', ...admin, async (ctx) => {
  const p = await db.maybe('SELECT * FROM partners WHERE id = $1', [ctx.param('id')]);
  if (!p) throw notFound('Partner not found.');
  return p;
});

const PartnerBody = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  contact: z.string().trim().min(1, 'Contact is required.').max(80),
  email: z.string().trim().email('Enter a valid email.'),
  focus: z.string().trim().min(1).max(80),
  segment: z.enum(['Strategic', 'Growth']),
  owner: z.string().trim().min(1, 'Programme owner is required.').max(80),
  status: z.enum(['Active', 'Invited', 'Suspended']),
  annualBudget: z.number().min(0).max(10_000_000).nullable().optional(),
});

adminRoutes.post('/partners', ...admin, async (ctx) => {
  const b = PartnerBody.parse(await ctx.json());
  const next = (await db.one(`SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '-', 2) AS INTEGER)), 0) + 1 AS n FROM partners`)).n;
  const p = await db.one(
    `INSERT INTO partners (code, name, contact, email, focus, segment, owner, status, annual_budget, goal)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      `BP-${String(next).padStart(3, '0')}`,
      b.name,
      b.contact,
      b.email,
      b.focus,
      b.segment,
      b.owner,
      b.status,
      b.annualBudget ?? settings().defaultAnnualBudget,
      'Run one joint campaign and complete team enablement this quarter.',
    ],
  );
  await audit({ userId: ctx.me.id, entity: 'partner', entityId: p.id, action: 'Partner created', note: p.name });
  ctx.status = 201;
  return p;
});

adminRoutes.put('/partners/:id', ...admin, async (ctx) => {
  const id = ctx.param('id');
  const b = PartnerBody.parse(await ctx.json());
  const n = await db.run(
    `UPDATE partners SET name=$1, contact=$2, email=$3, focus=$4, segment=$5, owner=$6, status=$7, annual_budget=COALESCE($8, annual_budget) WHERE id=$9`,
    [b.name, b.contact, b.email, b.focus, b.segment, b.owner, b.status, b.annualBudget ?? null, id],
  );
  if (!n) throw notFound('Partner not found.');
  await audit({ userId: ctx.me.id, entity: 'partner', entityId: id, action: 'Partner updated', note: b.name });
  return { ok: true };
});

// ---------- Settings ----------

const SettingsBody = z.object({
  programmeName: z.string().trim().min(1, 'Programme name is required.').max(80),
  contributionPercent: z.number().min(1, 'Contribution must be at least 1%.').max(100, 'Contribution cannot exceed 100%.'),
  maxRequestGbp: z.number().min(1).max(10_000_000),
  defaultAnnualBudget: z.number().min(0).max(10_000_000),
  pointsPerActivity: z.number().int().min(0).max(100_000),
  pointsPerApprovedClaim: z.number().int().min(0).max(100_000),
});

adminRoutes.get('/settings', ...admin, () => ({ values: settings(), defaults: DEFAULT_SETTINGS }));

adminRoutes.put('/settings', ...admin, async (ctx) => {
  const saved = await saveSettings(SettingsBody.parse(await ctx.json()));
  await audit({ userId: ctx.me.id, entity: 'settings', entityId: 0, action: 'Settings updated' });
  return { values: saved, defaults: DEFAULT_SETTINGS };
});
