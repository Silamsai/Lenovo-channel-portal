import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useUser } from '../auth/AuthContext';
import { brand } from '../config/brand';
import { api } from '../api/client';
import type { ReviewQueue } from '../api/types';

type Item = [to: string, icon: string, label: string];

const partnerNav: Item[] = [
  ['/', '⌂', 'Overview'],
  ['/funding', '£', 'Funding & claims'],
  ['/campaigns', '▣', 'My campaigns'],
  ['/library', '▦', 'Campaign library'],
  ['/enablement', '▤', 'Enablement'],
  ['/reports', '▥', 'Reports'],
];
const partnerProgramme: Item[] = [
  ['/profile', '◇', 'Our profile'],
  ['/benefits', '◇', 'Benefits'],
  ['/rewards', '☆', 'Rewards'],
];
const reviewerNav: Item[] = [
  ['/', '⌂', 'Overview'],
  ['/review', '✓', 'Review queue'],
  ['/funding', '£', 'Funding & claims'],
  ['/library', '▦', 'Campaign library'],
  ['/reports', '▥', 'Reports'],
];
const reviewerProgramme: Item[] = [
  ['/partners', '▦', 'Partner network'],
  ['/administration', '☆', 'Administration'],
];

export function Layout() {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isReviewer = user.role === 'REVIEWER';

  const queue = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => api<ReviewQueue>('/reviews/queue'),
    enabled: isReviewer,
  });
  const queueCount = queue.data
    ? queue.data.funding.length + queue.data.assets.length + queue.data.claims.length + queue.data.benefits.length + queue.data.points.length
    : 0;

  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  const link = ([to, icon, label]: Item) => (
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
      <span className="navicon" aria-hidden>
        {icon}
      </span>
      {label}
      {to === '/review' && queueCount > 0 && <span className="navcount">{queueCount}</span>}
    </NavLink>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img className="wordmark-logo" src={brand.logo} alt={brand.name} />
          <span>{brand.product}</span>
        </NavLink>
        <div className="topright">
          <span className="role-tag">{isReviewer ? 'Programme reviewer' : 'Partner marketer'}</span>
          <button
            className="quiet"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            {user.name} · Sign out
          </button>
        </div>
      </header>
      <aside className="sidebar">
        <div className="org">
          <span className="avatar">{(user.partner?.name ?? brand.name).charAt(0)}</span>
          <div>
            <strong>{user.partner?.name ?? `${brand.name} programme team`}</strong>
            <small>
              {brand.programme} · {brand.market}
            </small>
          </div>
        </div>
        <nav aria-label="Main">
          {(isReviewer ? reviewerNav : partnerNav).map(link)}
          <div className="nav-section">Partner programme</div>
          {(isReviewer ? reviewerProgramme : partnerProgramme).map(link)}
        </nav>
      </aside>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
