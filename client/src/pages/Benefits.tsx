import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAction } from '../api/hooks';
import { dateLabel } from '../api/format';
import { Badge, Crumbs, ErrorText, Loading, Modal, PageHead } from '../components/ui';

export interface BenefitsData {
  items: { id: number; name: string; description: string; segment: string; limitText: string; eligible: boolean }[];
  requests: { id: number; benefit: string; partner: string; note: string; status: string; decisionNote: string | null; createdAt: string }[];
}

export function Benefits() {
  const q = useQuery({ queryKey: ['benefits'], queryFn: () => api<BenefitsData>('/benefits') });
  const [open, setOpen] = useState<BenefitsData['items'][number] | null>(null);
  const [note, setNote] = useState('');
  const { run, busy, error, setError } = useAction();
  if (q.isLoading) return <Loading />;
  const data = q.data!;

  return (
    <>
      <Crumbs items={['Benefits']} />
      <PageHead title="Partner benefits" sub="Discover available support and track your requests." />
      <div className="cards">
        {data.items.map((b) => (
          <article className="card" key={b.id}>
            <div className="cardbody">
              <span className="badge">{b.segment === 'All' ? 'All partners' : `${b.segment} partners`}</span>
              <h3>{b.name}</h3>
              <p>{b.description}</p>
              <span className="muted small">{b.limitText}</span>
            </div>
            {b.eligible ? (
              <button
                className="cardfoot"
                onClick={() => {
                  setOpen(b);
                  setNote('');
                  setError('');
                }}
              >
                Request {b.name.toLowerCase()} <span>→</span>
              </button>
            ) : (
              <span className="cardfoot muted">Not available for your segment</span>
            )}
          </article>
        ))}
      </div>
      <section className="panel flush">
        <div className="panelhead">
          <h2>Your benefit requests</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Benefit</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.benefit}
                    <small>{r.note}</small>
                  </td>
                  <td>{dateLabel(r.createdAt)}</td>
                  <td>
                    <Badge>{r.status}</Badge>
                  </td>
                  <td>{r.decisionNote ?? '—'}</td>
                </tr>
              ))}
              {!data.requests.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Modal open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(() => api(`/benefits/${open.id}/request`, { body: { note } }), 'Benefit requested.');
              if (ok) setOpen(null);
            }}
          >
            <h2>Request {open.name.toLowerCase()}</h2>
            <p className="muted">{open.limitText}</p>
            <div className="field">
              <label htmlFor="b-note">What do you need?</label>
              <textarea id="b-note" required maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <ErrorText>{error}</ErrorText>
            <button className="btn" disabled={busy}>
              Send request →
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
