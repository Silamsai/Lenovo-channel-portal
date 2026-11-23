import { requireUser } from '@/lib/session';
import { PartnerProfile } from '@/components/PartnerProfile';

export const metadata = { title: 'Our profile' };

export default async function ProfilePage() {
  const user = await requireUser('PARTNER');
  return <PartnerProfile user={user} idKey="me" />;
}
