import { apiGet } from '@/lib/api';
import { createUser } from '@/lib/actions';
import { requireUser } from '@/lib/session';
import { PageHead } from '@/components/ui';
import { UserForm, type AdminPartner } from '../../shared';

export const metadata = { title: 'Add user' };

export default async function NewUserPage() {
  const me = await requireUser('ADMIN');
  const partners = await apiGet<AdminPartner[]>('/admin/partners');
  return (
    <>
      <div className="breadcrumb">
        <a href="/admin/users">Users</a> / Add user
      </div>
      <PageHead role={me.role} title="Add a user" sub="Create a partner, reviewer or admin account with a temporary password." />
      <section className="panel narrow">
        <UserForm action={createUser} partners={partners} />
      </section>
    </>
  );
}
