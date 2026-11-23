import type { HistoryEntry } from '../api/types';

export function History({ entries, title = 'Decision history' }: { entries: HistoryEntry[]; title?: string }) {
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
