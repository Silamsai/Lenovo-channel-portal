import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { money } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { Kv, Metric, PageHead } from '@/components/ui';

export const metadata = { title: 'Admin overview' };

interface AdminOverviewData {
  users: { total: number; active: number; inactive: number; byRole: Record<string, number>; activeThisWeek: number };
  partners: { total: number; active: number; invited: number };
  funding: { total: number; submitted: number; approvedAmount: number };
  claims: { submitted: number; approvedAmount: number; paidAmount: number };
  recent: { id: number; by: string; entity: string; action: string; note: string | null; createdAt: string }[];
}

export default async function AdminOverviewPage() {
  const user = await requireUser('ADMIN');
  const d = await apiGet<AdminOverviewData>('/admin/overview');

  return (
    <>
      <PageHead
        role={user.role}
        title="Overview"
        sub="Accounts, partner organisations and activity across the whole platform."
        action={
          <Link className="btn" href="/admin/users/new">
            ＋ Add user
          </Link>
        }
      />
      <div className="metrics">
        <Metric href="/admin/users" label="Users" value={d.users.total} note={`${d.users.active} active · ${d.users.inactive} deactivated`} />
        <Metric href="/admin/users?tab=partners" label="Partner organisations" value={d.partners.total} note={`${d.partners.active} active · ${d.partners.invited} invited or suspended`} />
        <Metric label="Funding approved" value={money(d.funding.approvedAmount)} note={`${d.funding.total} requests · ${d.funding.submitted} in review`} />
        <Metric label="Claims paid" value={money(d.claims.paidAmount)} note={`${money(d.claims.approvedAmount)} approved · ${d.claims.submitted} in review`} />
      </div>
      <div className="grid">
        <section className="panel flush">
          <div className="panelhead">
            <h2>Recent activity</h2>
            <span className="muted small">Audit log · latest 12</span>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>By</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.action}
                      <small>
                        {r.entity}
                        {r.note ? ` · ${r.note}` : ''}
                      </small>
                    </td>
                    <td>{r.by}</td>
                    <td>{new Date(r.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  </tr>
                ))}
                {!d.recent.length && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <div>
          <section className="panel">
            <h3>Accounts by role</h3>
            <Kv k="Partner users" v={d.users.byRole.PARTNER ?? 0} />
            <Kv k="Programme reviewers" v={d.users.byRole.REVIEWER ?? 0} />
            <Kv k="Platform admins" v={d.users.byRole.ADMIN ?? 0} />
            <Kv k="Signed in this week" v={d.users.activeThisWeek} />
            <Link className="btn secondary spaced" href="/admin/users">
              Manage users →
            </Link>
          </section>
          <section className="panel">
            <h3>Programme settings</h3>
            <p className="muted small">Funding limits, contribution share, default budgets and reward points.</p>
            <Link className="btn secondary" href="/admin/settings">
              Open settings →
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
