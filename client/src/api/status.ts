import type { Funding } from './types';

export interface NextStep {
  title: string;
  label: string;
  to: string;
  tag: string;
}

/** The one thing to do next for a funding request / campaign. */
export function nextStep(f: Funding): NextStep | null {
  const c = f.campaign;
  const j = (step: number) => `/campaigns/${f.id}/${step}`;
  if (f.status === 'Draft') return { title: 'Finish your funding request', label: 'Open request', to: `/funding/${f.id}`, tag: 'Funding' };
  if (f.status === 'Changes requested') return { title: 'Update your funding request', label: 'Open request', to: `/funding/${f.id}`, tag: 'Changes' };
  if (f.status === 'Submitted') return { title: 'Funding request awaiting review', label: 'View request', to: `/funding/${f.id}`, tag: 'In review' };
  if (f.status === 'Rejected') return null;
  if (!c) return { title: 'Start your funded campaign', label: 'Start campaign', to: j(3), tag: 'Ready' };
  const claim = c.claim;
  if (claim && ['Submitted', 'Approved', 'Rejected'].includes(claim.status)) {
    if (claim.status === 'Submitted') return { title: 'Claim awaiting review', label: 'View claim', to: j(5), tag: 'In review' };
    return null;
  }
  if (c.assetStatus === 'Submitted') return { title: 'Campaign assets awaiting approval', label: 'View assets', to: j(3), tag: 'In review' };
  if (!c.assetsApproved) return { title: 'Submit campaign assets for approval', label: 'Manage assets', to: j(3), tag: c.assetStatus === 'Changes requested' ? 'Changes' : 'Assets' };
  if (!c.resultsReady) return { title: 'Add campaign performance', label: 'Add results', to: j(4), tag: 'Required' };
  if (!c.evidenceComplete) return { title: 'Complete your proof of execution', label: 'Build POE pack', to: j(4), tag: 'Claim' };
  return { title: 'Submit your claim', label: 'Open claim', to: j(5), tag: claim?.status === 'Changes requested' ? 'Changes' : 'Claim' };
}

/** Short status label for tables. */
export function campaignStatus(f: Funding): string {
  const c = f.campaign;
  if (f.status !== 'Approved') return f.status === 'Submitted' ? 'Funding in review' : f.status;
  if (!c) return 'Ready to start';
  if (c.claim?.paidAt) return 'Paid';
  if (c.claim && c.claim.status !== 'Draft') return `Claim ${c.claim.status.toLowerCase()}`;
  if (!c.assetsApproved) return c.assetStatus === 'Submitted' ? 'Assets in review' : 'Assets required';
  if (!c.resultsReady) return 'Results required';
  if (!c.evidenceComplete) return 'Evidence required';
  return 'Ready to claim';
}

/** Which journey steps can be opened. */
export function stepAllowed(f: Funding, step: number) {
  if (step <= 2) return true;
  if (f.status !== 'Approved') return false;
  if (step === 3) return true;
  return !!f.campaign?.assetsApproved || !!f.campaign?.claim && f.campaign.claim.status !== 'Draft';
}
