import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { fileSize, QUARTERS, quarterLabel } from '../api/format';
import type { FileInfo } from '../api/types';

export function Badge({ children }: { children: string }) {
  const t = children;
  const tone = /Rejected/i.test(t)
    ? 'red'
    : /Approved|Complete|Ready|Recorded|Paid|Attached|Active|reported/i.test(t)
      ? 'green'
      : /Submitted|review|progress|Started/i.test(t)
        ? 'blue'
        : /Changes|Missing|Required|Pending|Invited/i.test(t)
          ? 'orange'
          : '';
  return <span className={`badge ${tone}`}>{t}</span>;
}

export function PageHead({ title, sub, action, eyebrow }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; eyebrow?: string }) {
  const user = useUser();
  return (
    <div className="pagetop">
      <div>
        <p className="eyebrow">{eyebrow ?? (user.role === 'REVIEWER' ? 'Programme workspace' : 'Partner workspace')}</p>
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
      <Link to="/">Home</Link>
      {items.map((i, n) => (
        <span key={n}>
          {' / '}
          {Array.isArray(i) ? <Link to={i[1]}>{i[0]}</Link> : i}
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

export function Metric({ label, value, note, to }: { label: string; value: ReactNode; note?: ReactNode; to?: string }) {
  const body = (
    <>
      <label>{label}</label>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </>
  );
  return to ? (
    <Link to={to} className="metric link">
      {body}
    </Link>
  ) : (
    <div className="metric">{body}</div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  return children ? (
    <p className="error" role="alert">
      {children}
    </p>
  ) : null;
}

export const Note = ({ children }: { children: ReactNode }) => <div className="note">{children}</div>;

export const Loading = () => <div className="panel muted">Loading…</div>;

export function QuarterSelect({ value, onChange, label = 'Calendar quarter' }: { value: string; onChange: (q: string) => void; label?: string }) {
  return (
    <div className="inline-field">
      <label htmlFor="quarter-filter">{label}</label>
      <select id="quarter-filter" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All quarters</option>
        {QUARTERS.map((q) => (
          <option key={q} value={q}>
            {quarterLabel(q)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Check({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <div className={`check ${done ? 'done' : ''}`}>
      <span aria-hidden>{done ? '✓' : '○'}</span> {children}
    </div>
  );
}

export function FileRows({
  files,
  onDownload,
  onRemove,
}: {
  files: FileInfo[];
  onDownload: (f: FileInfo) => void;
  onRemove?: (f: FileInfo) => void;
}) {
  if (!files.length) return <p className="muted small">No files yet.</p>;
  return (
    <div>
      {files.map((f) => (
        <div className="file-row" key={f.id}>
          <span>
            {f.name}
            <small>{fileSize(f.size)}</small>
          </span>
          <div className="actions">
            <button type="button" className="textbutton" onClick={() => onDownload(f)}>
              Download
            </button>
            {onRemove && (
              <button type="button" className="textbutton" onClick={() => onRemove(f)}>
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UploadButton({ label, onFiles, disabled }: { label: string; onFiles: (files: FileList) => void; disabled?: boolean }) {
  return (
    <label className={`upload ${disabled ? 'disabled' : ''}`}>
      {label}
      <input
        type="file"
        multiple
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </label>
  );
}

// ---------- Modal ----------

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="modal">
      {open && children}
      <button type="button" className="modal-close" aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
    </dialog>
  );
}

/** A reviewer decision form: approve, request changes or reject, with a note. */
export function DecisionForm({
  options,
  onDecide,
  busy,
  error,
}: {
  options: ('Approved' | 'Changes requested' | 'Rejected')[];
  onDecide: (decision: string, note: string) => void;
  busy?: boolean;
  error?: string;
}) {
  const [note, setNote] = useState('');
  const label = (o: string) => (o === 'Approved' ? 'Approve' : o === 'Rejected' ? 'Reject' : 'Request changes');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        onDecide(submitter?.value ?? 'Approved', note);
      }}
    >
      <div className="field">
        <label htmlFor="decision-note">Decision note (required unless approving)</label>
        <textarea id="decision-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="actions">
        {options.map((o, i) => (
          <button key={o} className={`btn ${i ? 'secondary' : ''}`} name="decision" value={o} disabled={busy}>
            {label(o)}
          </button>
        ))}
      </div>
    </form>
  );
}

// ---------- Toasts ----------

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMessage(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(''), 4000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={`toast ${message ? 'show' : ''}`} role="status">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
