import { FundingList, type ListParams } from './FundingList';

export const metadata = { title: 'Funding requests' };

export default async function FundingPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  return <FundingList tab="funding" params={await searchParams} />;
}
