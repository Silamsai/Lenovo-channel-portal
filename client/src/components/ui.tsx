import Form from 'next/form';
import Link from 'next/link';
/** Presentational building blocks. Server components: no client JavaScript. */
import type { ReactNode } from 'react';
import { QUARTERS, fileSize, quarterLabel } from '@/lib/format';
import type { FileInfo, Role } from '@/lib/types';
import { AutoSubmitSelect } from './forms';

export function Badge({ children }: { children: string }) {
  const t = children;
  const tone = /Rejected|Suspended/i.test(t)
    ? 'red'
    : /Approved|Complete|Ready|Recorded|Paid|Attached|Active|reported/i.test(t)
      ? 'green'
      : /Submitted|review|progress|Started/i.test(t)
        ? 'blue'
        : /Changes|Missing|Required|Pending|Invited|Deactivated/i.test(t)
          ? 'orange'
          : '';
  return <span className={`badge ${tone}`}>{t}</span>;
}

/**
 * Page title row. The page title and description are shown in the white top bar
 * (components/TopbarTitle.tsx), so here only the page's action buttons are rendered.
 * title/sub/role/eyebrow are kept as props so pages can still pass them (and for screen readers).
 */
export function PageHead({
  title,
  sub,
  action,
  role = 'PARTNER',
  eyebrow,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  role?: Role;
  eyebrow?: string;
}) {
  const defaultEyebrow =
    eyebrow ??
    (role === 'REVIEWER'
      ? 'Programme review'
      : role === 'ADMIN'
        ? 'Platform administration'
        : 'Partner workspace');

  return (
    <div className="pagetop">
      <div className="pagetop-head">
        {defaultEyebrow && <p className="eyebrow brand-eyebrow">{defaultEyebrow}</p>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {action && <div className="pagetop-action">{action}</div>}
    </div>
  );
}

export function Crumbs({ items }: { items: (string | [string, string])[] }) {
  return (
    <div className="breadcrumb">
      <Link href="/">Home</Link>
      {items.map((i, n) => (
        <span key={n}>
          {' / '}
          {Array.isArray(i) ? <Link href={i[1]}>{i[0]}</Link> : i}
        </span>
      ))}
    </div>
  );
}

export const Kv = ({ k, v }: { k: ReactNode; v: ReactNode }) => (
  <div className="kv">
    <span>{k}</span>
    <strong>{v}</strong>
  </div>
);

export function Metric({ label, value, note, href }: { label: string; value: ReactNode; note?: ReactNode; href?: string }) {
  const body = (
    <>
      <label>
        {label} {href && <span className="arrow">↗</span>}
      </label>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </>
  );
  return href ? (
    <Link href={href} className="metric link">
      {body}
    </Link>
  ) : (
    <div className="metric">{body}</div>
  );
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}

export const Note = ({ children }: { children: ReactNode }) => <div className="note">{children}</div>;

export function Check({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <div className={`check ${done ? 'done' : ''}`}>
      <span aria-hidden>{done ? '✓' : '○'}</span> {children}
    </div>
  );
}

/** Page-level success banner driven by a query string (after a redirect). */
export function Flash({ message }: { message?: string }) {
  return message ? (
    <p className="success banner" role="status">
      {message}
    </p>
  ) : null;
}

/**
 * GET filter form: changing a select reloads the page with new query parameters.
 * Uses next/form so the new results load without a full page reload.
 */
export function FilterBar({ action, children, quarter, label = 'Reporting period' }: { action: string; children?: ReactNode; quarter?: string; label?: string }) {
  return (
    <Form action={action} className="filters">
      {children}
      {quarter !== undefined && (
        <div className="inline-field">
          <label htmlFor="quarter">{label}</label>
          <AutoSubmitSelect name="quarter" label={label} value={quarter} options={[['all', 'All quarters'], ...QUARTERS.map((q) => [q, quarterLabel(q)] as [string, string])]} />
        </div>
      )}
      <noscript>
        <button className="btn secondary">Apply</button>
      </noscript>
    </Form>
  );
}

/** File list with download links; `remove` renders a remove control per file. */
export function FileRows({ files, downloadBase, remove }: { files: FileInfo[]; downloadBase: string; remove?: (f: FileInfo) => ReactNode }) {
  if (!files.length) return <p className="muted small">No files yet.</p>;
  return (
    <div>
      {files.map((f) => (
        <div className="file-row" key={f.id}>
          <span>
            {f.name}
            <small>{fileSize(f.size)}</small>
          </span>
          <div className="actions nowrap">
            <a className="textbutton" href={`${downloadBase}/${f.id}`}>
              Download
            </a>
            {remove?.(f)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function History({ entries, title = 'Decision history' }: { entries: { id: number; action: string; note: string | null; createdAt: string; by: string }[]; title?: string }) {
  if (!entries.length) return null;
  return (
    <section className="panel">
      <h3>{title}</h3>
      <ol className="history">
        {entries.map((h) => (
          <li key={h.id}>
            <strong>{h.action}</strong>
            <small>
              {h.by} · {new Date(h.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </small>
            {h.note && <p>{h.note}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
