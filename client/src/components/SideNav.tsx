'use client';

import { usePathname } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  LuAward,
  LuBuilding2,
  LuChartColumn,
  LuClipboardCheck,
  LuGift,
  LuGraduationCap,
  LuLayoutDashboard,
  LuLibrary,
  LuMegaphone,
  LuNetwork,
  LuPoundSterling,
  LuSettings,
  LuShieldCheck,
  LuUsers,
} from 'react-icons/lu';
import type { Role } from '@/lib/types';

type Item = [href: string, Icon: IconType, label: string];

const NAV: Record<Role, { main: Item[]; programme?: Item[] }> = {
  PARTNER: {
    main: [
      ['/', LuLayoutDashboard, 'Overview'],
      ['/funding', LuPoundSterling, 'Funding & claims'],
      ['/campaigns', LuMegaphone, 'My campaigns'],
      ['/library', LuLibrary, 'Campaign library'],
      ['/enablement', LuGraduationCap, 'Enablement'],
      ['/reports', LuChartColumn, 'Reports'],
    ],
    programme: [
      ['/profile', LuBuilding2, 'Our profile'],
      ['/benefits', LuGift, 'Benefits'],
      ['/rewards', LuAward, 'Rewards'],
    ],
  },
  REVIEWER: {
    main: [
      ['/', LuLayoutDashboard, 'Overview'],
      ['/review', LuClipboardCheck, 'Review queue'],
      ['/funding', LuPoundSterling, 'Funding & claims'],
      ['/library', LuLibrary, 'Campaign library'],
      ['/reports', LuChartColumn, 'Reports'],
    ],
    programme: [
      ['/partners', LuNetwork, 'Partner network'],
      ['/administration', LuShieldCheck, 'Administration'],
    ],
  },
  ADMIN: {
    main: [
      ['/admin', LuLayoutDashboard, 'Overview'],
      ['/admin/users', LuUsers, 'Users'],
      ['/admin/settings', LuSettings, 'Settings'],
    ],
  },
};

/** Sidebar links. Plain <a> links: every click loads a new page from the server. */
export function SideNav({ role, queueCount }: { role: Role; queueCount: number }) {
  const path = usePathname();
  const active = (href: string) =>
    href === '/' || href === '/admin' ? path === href : path === href || path.startsWith(href + '/') || (href === '/funding' && path === '/claims');
  const link = ([href, Icon, label]: Item) => (
    <a key={href} href={href} className={active(href) ? 'active' : undefined} aria-current={active(href) ? 'page' : undefined}>
      <Icon className="navicon" aria-hidden />
      {label}
      {href === '/review' && queueCount > 0 && <span className="navcount">{queueCount}</span>}
    </a>
  );
  const nav = NAV[role];
  return (
    <nav aria-label="Main">
      {nav.main.map(link)}
      {nav.programme && (
        <>
          <div className="nav-section">Partner programme</div>
          {nav.programme.map(link)}
        </>
      )}
    </nav>
  );
}
