import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { deleteUser, resetPassword, updateUser } from '@/lib/actions';
import { dateLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { Badge, Kv, PageHead } from '@/components/ui';
import { ActionForm, Submit } from '@/components/forms';
import { ROLE_LABELS, UserForm, type AdminPartner, type AdminUser } from '../../shared';

export const metadata = { title: 'Manage user' };

export default async function ManageUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser('ADMIN');
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [user, partners] = await Promise.all([apiGet<AdminUser>(`/admin/users/${id}`), apiGet<AdminPartner[]>('/admin/partners')]);
  const isSelf = user.id === me.id;

  return (
    <>
      <div className="breadcrumb">
        <a href="/admin/users">Users</a> / {user.name}
      </div>
      <PageHead role={me.role} title={user.name} sub={`${user.email} · ${ROLE_LABELS[user.role]}${isSelf ? ' · you' : ''}`} action={<Badge>{user.active ? 'Active' : 'Deactivated'}</Badge>} />
      <div className="grid">
        <section className="panel">
          <h2>Account details</h2>
          <UserForm action={updateUser.bind(null, user.id, isSelf)} user={user} partners={partners} isSelf={isSelf} />
        </section>
        <div>
          <section className="panel">
            <h3>Reset password</h3>
            <ActionForm action={resetPassword.bind(null, user.id)}>
              <div className="field">
                <label htmlFor="r-password">New password (min. 8 characters)</label>
                <input id="r-password" name="password" type="text" required minLength={8} autoComplete="new-password" />
              </div>
              <Submit secondary>Set password</Submit>
            </ActionForm>
          </section>
          <section className="panel">
            <h3>Activity</h3>
            <Kv k="Last sign-in" v={user.lastLoginAt ? dateLabel(user.lastLoginAt) : 'Never'} />
            <Kv k="Created" v={dateLabel(user.createdAt)} />
          </section>
          {!isSelf && (
            <section className="panel danger-zone">
              <h3>Delete user</h3>
              <p className="muted small">The user loses access immediately. Past actions stay in the audit history. To block sign-in but keep the account, untick “Account active” instead.</p>
              <ActionForm action={deleteUser.bind(null, user.id)} confirm={`Delete ${user.email}? This cannot be undone.`}>
                <Submit danger>Delete user</Submit>
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
