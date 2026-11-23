import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAction } from '../api/hooks';
import { dateLabel } from '../api/format';
import type { ReviewQueue } from '../api/types';
import { Crumbs, DecisionForm, Loading, Modal, PageHead } from '../components/ui';
import type { BenefitsData } from './Benefits';

type Target = { kind: 'benefit' | 'points'; id: number; title: string; detail: string };

export function Administration() {
  const queue = useQuery({ queryKey: ['review-queue'], queryFn: () => api<ReviewQueue>('/reviews/queue') });
  const benefits = useQuery({ queryKey: ['benefits'], queryFn: () => api<BenefitsData>('/benefits') });
  const [target, setTarget] = useState<Target | null>(null);
  const { run, busy, error, setError } = useAction();
  if (queue.isLoading || benefits.isLoading) return <Loading />;
  const q = queue.data!;
  const history = (benefits.data?.requests ?? []).filter((r) => r.status !== 'Pending');

  async function decide(decision: string, note: string) {
    if (!target) return;
    const path = target.kind === 'benefit' ? `/benefits/requests/${target.id}/decision` : `/rewards/entries/${target.id}/decision`;
    const ok = await run(() => api(path, { body: { decision, note } }), `Decision recorded: ${decision}.`);
    if (ok) setTarget(null);
  }

  const open = (t: Target) => {
    setError('');
    setTarget(t);
  };

  return (
    <>
      <Crumbs items={['Administration']} />
      <PageHead title="Programme administration" sub="Review benefit and reward requests across the partner network." />
      <div className="grid">
        <section className="panel flush">
          <div className="panelhead">
            <h2>Benefit requests</h2>
            <span className="count">{q.benefits.length}</span>
          </div>
          {q.benefits.map((b) => (
            <div className="task" key={b.id}>
              <span className="num">◇</span>
              <div>
                <strong>
                  {b.benefit} · {b.partner}
                </strong>
                <p>
                  {b.note} · {dateLabel(b.createdAt)}
                </p>
              </div>
              <button className="textbutton" onClick={() => open({ kind: 'benefit', id: b.id, title: b.benefit, detail: `${b.partner}: ${b.note}` })}>
                Decide →
              </button>
            </div>
          ))}
          {!q.benefits.length && <p className="muted pad">No pending benefit requests.</p>}
        </section>
        <section className="panel flush">
          <div className="panelhead">
            <h2>Points requests</h2>
            <span className="count">{q.points.length}</span>
          </div>
          {q.points.map((p) => (
            <div className="task" key={p.id}>
              <span className="num">☆</span>
              <div>
                <strong>
                  {p.kind === 'earn' ? 'Earn' : 'Redeem'} {Math.abs(p.points)} pts · {p.partner}
                </strong>
                <p>
                  {p.reason}
                  {p.evidence ? ` · ${p.evidence}` : ''}
                </p>
              </div>
              <button className="textbutton" onClick={() => open({ kind: 'points', id: p.id, title: `${p.kind === 'earn' ? 'Award' : 'Redeem'} ${Math.abs(p.points)} points`, detail: `${p.partner}: ${p.reason}` })}>
                Decide →
              </button>
            </div>
          ))}
          {!q.points.length && <p className="muted pad">No pending points requests.</p>}
        </section>
      </div>
      <section className="panel flush">
        <div className="panelhead">
          <h2>Decided benefit requests</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Benefit</th>
                <th>Partner</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td>{r.benefit}</td>
                  <td>{r.partner}</td>
                  <td>{r.status}</td>
                  <td>{r.decisionNote ?? '—'}</td>
                </tr>
              ))}
              {!history.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    Nothing decided yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Modal open={!!target} onClose={() => setTarget(null)}>
        {target && (
          <>
            <h2>{target.title}</h2>
            <p className="muted">{target.detail}</p>
            <DecisionForm options={['Approved', 'Rejected']} onDecide={decide} busy={busy} error={error} />
          </>
        )}
      </Modal>
    </>
  );
}
