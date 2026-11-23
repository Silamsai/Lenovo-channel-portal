import { apiGet } from '@/lib/api';
import { dateLabel, money } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { Badge, FilterBar, Flash, PageHead } from '@/components/ui';
import { AutoSubmitSelect } from '@/components/forms';
import { ROLE_LABELS, type AdminPartner, type AdminUser } from '../shared';

export const metadata = { title: 'Users' };

type Params = { tab?: string; q?: string; role?: string; status?: string; saved?: string };
const SAVED: Record<string, string> = { created: 'Saved: created.', updated: 'Saved: changes stored.', deleted: 'User deleted.' };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requireUser('ADMIN');
  const params = await searchParams;
  const tab = params.tab === 'partners' ? 'partners' : 'users';
  const q = (params.q ?? '').toLowerCase();

  return (
    <>
      <PageHead role={me.role} title="Users" sub="Create and manage partner, reviewer and admin accounts, and the partner organisations they belong to." />
      <div className="tabs">
        <a href="/admin/users" className={tab === 'users' ? 'on' : ''}>
          User accounts
        </a>
        <a href="/admin/users?tab=partners" className={tab === 'partners' ? 'on' : ''}>
          Partner organisations
        </a>
      </div>
      <Flash message={params.saved ? SAVED[params.saved] : undefined} />
      {tab === 'users' ? <UsersTab meId={me.id} q={q} params={params} /> : <PartnersTab q={q} params={params} />}
    </>
  );
}

async function UsersTab({ meId, q, params }: { meId: number; q: string; params: Params }) {
  const all = await apiGet<AdminUser[]>('/admin/users');
  const role = params.role ?? '';
  const status = params.status ?? '';
  const rows = all.filter(
    (u) =>
      `${u.name} ${u.email} ${u.partner?.name ?? ''}`.toLowerCase().includes(q) &&
      (!role || u.role === role) &&
      (!status || (status === 'active' ? u.active : !u.active)),
  );
  return (
    <>
      <FilterBar action="/admin/users">
        <input name="q" aria-label="Search users" placeholder="Search name, email or organisation" defaultValue={params.q ?? ''} />
        <AutoSubmitSelect name="role" label="Role" value={role} options={[['', 'All roles'], ...Object.entries(ROLE_LABELS)]} />
        <AutoSubmitSelect name="status" label="Status" value={status} options={[['', 'All statuses'], ['active', 'Active'], ['inactive', 'Deactivated']]} />
        <a className="btn" href="/admin/users/new">
          ＋ Add user
        </a>
      </FilterBar>
      <section className="panel flush">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Organisation</th>
                <th>Last sign-in</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small>
                      {u.email}
                      {u.id === meId ? ' · you' : ''}
                    </small>
                  </td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>{u.partner ? u.partner.name : <span className="muted">{u.role === 'PARTNER' ? 'None' : 'Programme team'}</span>}</td>
                  <td>{u.lastLoginAt ? dateLabel(u.lastLoginAt) : <span className="muted">Never</span>}</td>
                  <td>
                    <Badge>{u.active ? 'Active' : 'Deactivated'}</Badge>
                  </td>
                  <td>
                    <a href={`/admin/users/${u.id}`}>Manage →</a>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="muted">
                    No matching users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

async function PartnersTab({ q, params }: { q: string; params: Params }) {
  const all = await apiGet<AdminPartner[]>('/admin/partners');
  const rows = all.filter((p) => `${p.name} ${p.code} ${p.focus}`.toLowerCase().includes(q));
  return (
    <>
      <FilterBar action="/admin/users">
        <input type="hidden" name="tab" value="partners" />
        <input name="q" aria-label="Search organisations" placeholder="Search organisation, code or focus" defaultValue={params.q ?? ''} />
        <a className="btn" href="/admin/partners/new">
          ＋ Add organisation
        </a>
      </FilterBar>
      <section className="panel flush">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Segment</th>
                <th>Annual budget</th>
                <th>Users</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>
                      {p.code} · {p.focus}
                    </small>
                  </td>
                  <td>{p.segment}</td>
                  <td>{money(p.annualBudget)}</td>
                  <td>
                    {p.userCount}
                    <small>{p.fundingCount} funding requests</small>
                  </td>
                  <td>
                    <Badge>{p.status}</Badge>
                  </td>
                  <td>
                    <a href={`/admin/partners/${p.id}`}>Edit →</a>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="muted">
                    No matching organisations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
