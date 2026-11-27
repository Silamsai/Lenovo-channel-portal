import Link from 'next/link';
import { LuLogOut } from 'react-icons/lu';
import { apiGet } from '@/lib/api';
import { logout } from '@/lib/actions';
import { brand } from '@/lib/brand';
import { homeFor, requireUser } from '@/lib/session';
import { SideNav } from '@/components/SideNav';

const ROLE_LABEL = { PARTNER: 'Partner marketer', REVIEWER: 'Programme reviewer', ADMIN: 'Platform admin' } as const;

/** Shell for every signed-in page: top bar with logo and bell, sidebar with navigation and sign-out. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === 'ADMIN';
  let queueCount = 0;
  if (user.role === 'REVIEWER') {
    // One small count query instead of loading the whole review queue on every page.
    queueCount = (await apiGet<{ count: number }>('/reviews/count')).count;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href={homeFor(user.role)} className="brand">
          <img className="wordmark-logo" src={brand.logo} alt={brand.name} />
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-product">{brand.product}</span>
        </Link>
        <div className="topright">
          <span className="demo-tag">{brand.name.toUpperCase()} DEMO / SAMPLE DATA</span>
          <button type="button" className="btn quiet" title="Demo environment">
            Reset demo
          </button>
          <div className="top-user">
            <span>{ROLE_LABEL[user.role]}</span>
            <span className="sep">·</span>
            <form action={logout} className="inline-form">
              <button className="top-signout">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <div className="org">
          <span className="avatar">{(user.partner?.name ?? brand.name).charAt(0)}</span>
          <div>
            <strong>{user.partner?.name ?? (isAdmin ? 'Platform administration' : `${brand.name} programme team`)}</strong>
            <small>{brand.market}</small>
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
