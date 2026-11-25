import { apiGet } from '@/lib/api';
import { changePassword } from '@/lib/actions';
import { dateLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { Badge, PageHead } from '@/components/ui';
import { PasswordCard } from '@/components/ProfileCards';
import { ROLE_LABELS, type AdminUser } from '../shared';

export const metadata = { title: 'Profile' };

/** The signed-in platform admin's own account details and password. */
export default async function AdminProfilePage() {
  const me = await requireUser('ADMIN');
  const users = await apiGet<AdminUser[]>('/admin/users');
  const self = users.find((u) => u.id === me.id);

  return (
    <>
      <PageHead role={me.role} title="Profile" sub="Your platform admin account and sign-in password." />
      <div className="grid">
        <section className="panel">
          <div className="panelhead plain">
            <h2>Account details</h2>
          </div>
          <div className="kv">
            <span>Name</span>
            <strong>{me.name}</strong>
          </div>
          <div className="kv">
            <span>Email (used to sign in)</span>
            <strong>{me.email}</strong>
          </div>
          <div className="kv">
            <span>Role</span>
            <strong>{ROLE_LABELS[me.role]}</strong>
          </div>
          <div className="kv">
            <span>Organisation</span>
            <strong>Programme team</strong>
          </div>
          {self && (
            <>
              <div className="kv">
                <span>Status</span>
                <strong>
                  <Badge>{self.active ? 'Active' : 'Deactivated'}</Badge>
                </strong>
              </div>
              <div className="kv">
                <span>Last sign-in</span>
                <strong>{self.lastLoginAt ? dateLabel(self.lastLoginAt) : 'Never'}</strong>
              </div>
              <div className="kv">
                <span>Account created</span>
                <strong>{dateLabel(self.createdAt)}</strong>
              </div>
            </>
          )}
        </section>
        <PasswordCard action={changePassword} />
      </div>
    </>
  );
}
