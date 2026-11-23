'use client';

import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/types';

type Title = [title: string, description: string];

/** Title and one-line description for each page, matched by URL (first match wins). */
const TITLES: [RegExp, Title | ((role: Role) => Title)][] = [
  [/^\/$/, (role) => (role === 'REVIEWER' ? ['Programme overview', 'Funding, campaigns and claims across all partners.'] : ['Overview', 'Your next steps, funding and campaign progress.'])],
  [/^\/funding\/new$/, ['Request funding', 'Plan an activity and request funding before committing spend.']],
  [/^\/funding\/\d+$/, ['Funding request', 'Activity details, budget and programme decision.']],
  [/^\/(funding|claims)$/, ['Funding & claims', 'Track funding requests and claims through to reimbursement.']],
  [/^\/campaigns$/, ['My campaigns', 'Every campaign follows five steps, from funding request to claim.']],
  [/^\/campaigns\/\d+/, ['Campaign', 'Funding, assets, performance, proof of execution and claim.']],
  [/^\/library\/[^/]+\/customise$/, ['Customise campaign', 'Add your partner details to the approved campaign kit.']],
  [/^\/library\/[^/]+$/, ['Campaign kit', 'Brief, assets and readiness checklist.']],
  [/^\/library$/, ['Campaign library', 'Approved kits to plan, customise and run your next campaign.']],
  [/^\/enablement$/, ['Enablement', 'Short modules that prepare your team to run campaigns.']],
  [/^\/reports$/, ['Reports', 'Campaign performance, claims and payments by quarter.']],
  [/^\/review$/, ['Review queue', 'Funding, assets and claims waiting for a decision.']],
  [/^\/partners\/\d+$/, ['Partner profile', 'Organisation, contacts, segment and points.']],
  [/^\/partners$/, ['Partner network', 'Every partner organisation in the programme.']],
  [/^\/profile$/, ['Our profile', 'Your organisation, contacts and programme segment.']],
  [/^\/benefits/, ['Benefits', 'Programme support you can request.']],
  [/^\/rewards$/, ['Rewards', 'Earn points for approved activity and redeem them.']],
  [/^\/administration$/, ['Administration', 'Decide partner benefit and reward requests.']],
  [/^\/admin$/, ['Overview', 'Accounts, organisations and activity across the platform.']],
  [/^\/admin\/users\/new$/, ['Add user', 'Create a partner, reviewer or admin account.']],
  [/^\/admin\/users\/\d+$/, ['Manage user', 'Account details, password and access.']],
  [/^\/admin\/users/, ['Users', 'Manage accounts and partner organisations.']],
  [/^\/admin\/partners\/new$/, ['Add organisation', 'Create a partner organisation.']],
  [/^\/admin\/partners\/\d+$/, ['Edit organisation', 'Organisation details, segment, status and budget.']],
  [/^\/admin\/settings$/, ['Settings', 'Programme rules used across all portals.']],
];

export function TopbarTitle({ role }: { role: Role }) {
  const path = usePathname();
  const match = TITLES.find(([re]) => re.test(path))?.[1];
  if (!match) return <div className="topbar-title" />;
  const [title, description] = typeof match === 'function' ? match(role) : match;
  return (
    <div className="topbar-title">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
