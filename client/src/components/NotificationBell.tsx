import { LuBell } from 'react-icons/lu';
import { apiGet } from '@/lib/api';
import { markNotificationsRead } from '@/lib/actions';

interface Notification {
  id: number;
  title: string;
  detail: string;
  link: string;
  createdAt: string;
  unread: boolean;
}

const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/**
 * Bell in the top bar, rendered on the server with every page.
 * Opens with <details> (no JavaScript needed); "Mark all as read" is a form post.
 */
export async function NotificationBell() {
  const data = await apiGet<{ items: Notification[]; unread: number }>('/notifications');
  const unread = data.unread;
  return (
    <details className="bell">
      <summary className="bell-button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <LuBell aria-hidden />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </summary>
      <div className="bell-panel" role="dialog" aria-label="Notifications">
        <div className="bell-head">
          <strong>Notifications</strong>
          {unread > 0 && (
            <form action={markNotificationsRead}>
              <button className="textbutton">Mark all as read</button>
            </form>
          )}
        </div>
        <div className="bell-list">
          {data.items.map((n) => (
            <a key={n.id} href={n.link} className={`bell-item ${n.unread ? 'unread' : ''}`}>
              <span className="bell-dot" aria-hidden />
              <span>
                <strong>{n.title}</strong>
                <small>{n.detail}</small>
                <small className="bell-time">{ago(n.createdAt)}</small>
              </span>
            </a>
          ))}
          {!data.items.length && <p className="muted small pad">You’re all caught up.</p>}
        </div>
      </div>
    </details>
  );
}
