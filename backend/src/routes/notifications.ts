import { db } from '../db';
import { auth, type AuthUser } from '../auth';
import { Router } from '../lib/router';

/**
 * Notifications are built from the audit log:
 *  - partners hear about decisions and payments on their own organisation's items,
 *  - reviewers hear about new submissions waiting for review,
 *  - platform admins hear about account, organisation and settings changes made by other admins.
 * Nobody is notified about their own actions. Unread = newer than the user's notifications_seen_at.
 */
export const notificationRoutes = new Router();

const SUBMISSION = `(a.action IN ('Submitted for review', 'Claim submitted', 'Requested', 'Earn submitted', 'Redemption requested') OR a.action LIKE 'Version % submitted')`;

/** Each audit row joined to the record it is about, with partner, title and link. */
const RESOLVED = `
  SELECT a.id, a.entity, a.action, a.note, a.created_at, a.user_id,
         COALESCE(f1.partner_id, f2.partner_id, f3.partner_id, br.partner_id, pe.partner_id) AS partner_id,
         COALESCE(f1.code, cl.code) AS code,
         COALESCE(f1.title, f2.title, f3.title, bi.name, pe.reason, pa.name) AS subject,
         COALESCE(p1.name, p2.name, p3.name, pb.name, pp.name) AS partner_name,
         COALESCE(f1.id, f2.id, f3.id) AS funding_id
    FROM audit_log a
    LEFT JOIN funding_requests f1 ON a.entity = 'funding' AND f1.id = a.entity_id
    LEFT JOIN partners p1 ON p1.id = f1.partner_id
    LEFT JOIN campaigns c2 ON a.entity = 'assets' AND c2.id = a.entity_id
    LEFT JOIN funding_requests f2 ON f2.id = c2.funding_id
    LEFT JOIN partners p2 ON p2.id = f2.partner_id
    LEFT JOIN claims cl ON a.entity = 'claim' AND cl.id = a.entity_id
    LEFT JOIN campaigns c3 ON c3.id = cl.campaign_id
    LEFT JOIN funding_requests f3 ON f3.id = c3.funding_id
    LEFT JOIN partners p3 ON p3.id = f3.partner_id
    LEFT JOIN benefit_requests br ON a.entity = 'benefit' AND br.id = a.entity_id
    LEFT JOIN benefit_items bi ON bi.id = br.benefit_id
    LEFT JOIN partners pb ON pb.id = br.partner_id
    LEFT JOIN points_entries pe ON a.entity = 'points' AND pe.id = a.entity_id
    LEFT JOIN partners pp ON pp.id = pe.partner_id
    LEFT JOIN partners pa ON a.entity = 'partner' AND pa.id = a.entity_id`;

function linkFor(entity: string, fundingId: number | null, role: AuthUser['role']) {
  switch (entity) {
    case 'funding':
      return `/funding/${fundingId}`;
    case 'assets':
      return `/campaigns/${fundingId}/3`;
    case 'claim':
      return `/campaigns/${fundingId}/5`;
    case 'benefit':
      return role === 'PARTNER' ? '/benefits' : '/administration';
    case 'points':
      return role === 'PARTNER' ? '/rewards' : '/administration';
    case 'partner':
      return '/admin/users?tab=partners';
    case 'settings':
      return '/admin/settings';
    default:
      return '/admin/users';
  }
}

function titleFor(r: Record<string, any>) {
  const prefix: Record<string, string> = { assets: 'Campaign assets', benefit: 'Benefit', points: 'Reward points' };
  if (r.entity === 'funding' || r.entity === 'claim') return `${r.code}: ${r.action}`;
  return prefix[r.entity] ? `${prefix[r.entity]}: ${r.action}` : r.action;
}

async function notificationsFor(user: AuthUser) {
  const me = await db.one('SELECT notifications_seen_at FROM users WHERE id = $1', [user.id]);
  let where: string;
  const params: unknown[] = [];
  if (user.role === 'PARTNER') {
    params.push(user.partnerId);
    // Partners: things others did to their organisation's records (not their colleagues' own actions).
    where = `r.entity IN ('funding','assets','claim','benefit','points') AND r.partner_id = $1
             AND r.action NOT IN ('Created', 'Draft saved')
             AND (r.user_id IS NULL OR r.user_id NOT IN (SELECT id FROM users WHERE partner_id = $1))`;
  } else if (user.role === 'REVIEWER') {
    params.push(user.id);
    where = `r.entity IN ('funding','assets','claim','benefit','points') AND ${SUBMISSION.replace(/a\./g, 'r.')} AND (r.user_id IS NULL OR r.user_id <> $1)`;
  } else {
    params.push(user.id);
    where = `r.entity IN ('user','partner','settings') AND (r.user_id IS NULL OR r.user_id <> $1)`;
  }
  const rows = await db.many(`SELECT * FROM (${RESOLVED}) r WHERE ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT 20`, params);
  const seen = me.notificationsSeenAt ? new Date(me.notificationsSeenAt).getTime() : 0;
  const isPartner = user.role === 'PARTNER';
  const items = rows.map((r) => ({
    id: r.id,
    title: titleFor(r),
    detail: [r.subject, isPartner ? null : r.partnerName, r.note].filter(Boolean).join(' · ') || (r.entity === 'settings' ? 'Programme rules changed' : ''),
    link: linkFor(r.entity, r.fundingId, user.role),
    createdAt: r.createdAt,
    unread: new Date(r.createdAt).getTime() > seen,
  }));
  return { items, unread: items.filter((n) => n.unread).length };
}

notificationRoutes.get('/', auth, (ctx) => notificationsFor(ctx.me));

notificationRoutes.post('/read', auth, async (ctx) => {
  await db.run('UPDATE users SET notifications_seen_at = now() WHERE id = $1', [ctx.me.id]);
  return { ok: true };
});
