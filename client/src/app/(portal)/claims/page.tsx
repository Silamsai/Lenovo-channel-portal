import { FundingList, type ListParams } from '../funding/FundingList';

export const metadata = { title: 'Claims' };

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  return <FundingList tab="claims" params={await searchParams} />;
}
