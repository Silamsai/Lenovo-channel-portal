import { notFound } from 'next/navigation';
import { RequestPage } from '../RequestPage';

export const metadata = { title: 'Funding request' };

export default async function FundingRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <RequestPage id={id} />;
}
