import { db } from '../db';
import { auth, role } from '../auth';
import { Router } from '../lib/router';
import { partnerBudget } from '../services/budget';
import { loadFunding, publicFunding } from '../services/serialize';

export const reviewRoutes = new Router();

/** Everything waiting for a programme decision. */
reviewRoutes.get('/queue', auth, role('REVIEWER'), async () => {
  const [funding, assets, claims, payments, benefits, points] = await Promise.all([
    loadFunding(`f.status = 'Submitted'`, [], 'f.submitted_at'),
    loadFunding(`EXISTS (SELECT 1 FROM campaigns c WHERE c.funding_id = f.id AND c.asset_status = 'Submitted')`),
    loadFunding(`EXISTS (SELECT 1 FROM campaigns c JOIN claims cl ON cl.campaign_id = c.id WHERE c.funding_id = f.id AND cl.status = 'Submitted')`),
    loadFunding(`EXISTS (SELECT 1 FROM campaigns c JOIN claims cl ON cl.campaign_id = c.id WHERE c.funding_id = f.id AND cl.status = 'Approved' AND cl.paid_at IS NULL)`),
    db.many(
      `SELECT r.id, p.name AS partner, b.name AS benefit, r.note, r.created_at
         FROM benefit_requests r JOIN partners p ON p.id = r.partner_id JOIN benefit_items b ON b.id = r.benefit_id
        WHERE r.status = 'Pending' ORDER BY r.created_at`,
    ),
    db.many(
      `SELECT e.id, p.name AS partner, e.kind, e.points, e.reason, e.evidence, e.created_at
         FROM points_entries e JOIN partners p ON p.id = e.partner_id
        WHERE e.status = 'Pending' ORDER BY e.created_at`,
    ),
  ]);
  return {
    funding: await Promise.all(funding.map(async (f) => ({ ...publicFunding(f), available: (await partnerBudget(f.partnerId, f.id)).available }))),
    assets: assets.map(publicFunding),
    claims: claims.map(publicFunding),
    payments: payments.map(publicFunding),
    benefits,
    points,
  };
});
