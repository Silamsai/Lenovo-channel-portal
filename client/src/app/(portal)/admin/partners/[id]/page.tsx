import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { updatePartner } from '@/lib/actions';
import { requireUser } from '@/lib/session';
import { Badge, PageHead } from '@/components/ui';
import { PartnerForm, type AdminPartner } from '../../shared';

export const metadata = { title: 'Edit organisation' };

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser('ADMIN');
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const partner = await apiGet<AdminPartner>(`/admin/partners/${id}`);
  return (
    <>
      <div className="breadcrumb">
        <a href="/admin/users?tab=partners">Partner organisations</a> / {partner.name}
      </div>
      <PageHead role={me.role} title={partner.name} sub={`${partner.code} · ${partner.focus}`} action={<Badge>{partner.status}</Badge>} />
      <section className="panel narrow">
        <PartnerForm action={updatePartner.bind(null, partner.id)} partner={partner} />
      </section>
    </>
  );
}
