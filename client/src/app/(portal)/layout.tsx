import { LuLogOut } from 'react-icons/lu';
import { apiGet } from '@/lib/api';
import { logout } from '@/lib/actions';
import { brand } from '@/lib/brand';
import { homeFor, requireUser } from '@/lib/session';
import type { ReviewQueue } from '@/lib/types';
import { NotificationBell } from '@/components/NotificationBell';
import { SideNav } from '@/components/SideNav';

const ROLE_LABEL = { PARTNER: 'Partner marketer', REVIEWER: 'Programme reviewer', ADMIN: 'Platform admin' } as const;

/** Shell for every signed-in page: top bar with logo and bell, sidebar with navigation and sign-out. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  let queueCount = 0;
  if (user.role === 'REVIEWER') {
    const q = await apiGet<ReviewQueue>('/reviews/queue');
    queueCount = q.funding.length + q.assets.length + q.claims.length + q.benefits.length + q.points.length;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <a href={homeFor(user.role)} className="brand">
          <b className="wordmark">{brand.name}</b>
          <span className="brand-product">{brand.product}</span>
        </a>
        <NotificationBell />
      </header>
      <aside className="sidebar">
        <div className="org">
          <span className="avatar">{(user.partner?.name ?? brand.name).charAt(0)}</span>
          <div>
            <strong>{user.partner?.name ?? (isAdmin ? 'Platform administration' : `${brand.name} programme team`)}</strong>
            <small>
              {brand.programme} · {brand.market}
            </small>
          </div>
        </div>
        <SideNav role={user.role} queueCount={queueCount} />
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <strong>{user.name}</strong>
            <small>{ROLE_LABEL[user.role]}</small>
          </div>
          <form action={logout}>
            <button className="signout">
              <LuLogOut aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main id="main">{children}</main>
    </div>
  );
}
