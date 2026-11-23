import { createPartner } from '@/lib/actions';
import { requireUser } from '@/lib/session';
import { PageHead } from '@/components/ui';
import { PartnerForm } from '../../shared';

export const metadata = { title: 'Add organisation' };

export default async function NewPartnerPage() {
  const me = await requireUser('ADMIN');
  return (
    <>
      <div className="breadcrumb">
        <a href="/admin/users?tab=partners">Partner organisations</a> / Add organisation
      </div>
      <PageHead role={me.role} title="Add a partner organisation" sub="New organisations get the default annual budget from Settings unless you set one." />
      <section className="panel narrow">
        <PartnerForm action={createPartner} />
      </section>
    </>
  );
}
