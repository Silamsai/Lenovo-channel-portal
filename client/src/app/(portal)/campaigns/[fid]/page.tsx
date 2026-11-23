import { notFound, redirect } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { requireUser } from '@/lib/session';
import type { Funding } from '@/lib/types';

/** /campaigns/12 opens the step that needs attention. */
export default async function CampaignIndex({ params }: { params: Promise<{ fid: string }> }) {
  await requireUser('PARTNER', 'REVIEWER');
  const fid = Number((await params).fid);
  if (!Number.isInteger(fid)) notFound();
  const { item } = await apiGet<{ item: Funding }>(`/funding/${fid}`);
  const step = item.status !== 'Approved' ? (item.status === 'Draft' ? 1 : 2) : !item.campaign || !item.campaign.assetsApproved ? 3 : 4;
  redirect(`/campaigns/${fid}/${step}`);
}
