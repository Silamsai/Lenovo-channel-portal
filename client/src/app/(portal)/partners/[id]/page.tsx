import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { PartnerProfile } from '@/components/PartnerProfile';

export const metadata = { title: 'Partner profile' };

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('REVIEWER');
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <PartnerProfile user={user} idKey={id} />;
}
