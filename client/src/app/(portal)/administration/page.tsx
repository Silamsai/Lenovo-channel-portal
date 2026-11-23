import { apiGet } from '@/lib/api';
import { decideBenefit, decidePoints } from '@/lib/actions';
import { dateLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { BenefitsData, ReviewQueue } from '@/lib/types';
import { Badge, Crumbs, PageHead } from '@/components/ui';
import { DecisionForm } from '@/components/DecisionForm';

export const metadata = { title: 'Administration' };

/** Reviewer decisions on partner benefit and points requests. */
export default async function AdministrationPage() {
  const user = await requireUser('REVIEWER');
  const [q, benefits] = await Promise.all([apiGet<ReviewQueue>('/reviews/queue'), apiGet<BenefitsData>('/benefits')]);
  const decided = benefits.requests.filter((r) => r.status !== 'Pending');

  return (
    <>
      <Crumbs items={['Administration']} />
      <PageHead role={user.role} title="Programme administration" sub="Decide benefit and reward requests across the partner network." />
      <div className="grid even">
        <section className="panel flush">
          <div className="panelhead">
            <h2>Benefit requests</h2>
            <span className="count">{q.benefits.length}</span>
          </div>
          {q.benefits.map((b) => (
            <details className="decide" key={b.id}>
              <summary>
                <strong>
                  {b.benefit} · {b.partner}
                </strong>
                <small>
                  {b.note} · {dateLabel(b.createdAt)}
                </small>
              </summary>
              <DecisionForm action={decideBenefit.bind(null, b.id)} options={['Approved', 'Rejected']} />
            </details>
          ))}
          {!q.benefits.length && <p className="muted pad">No pending benefit requests.</p>}
        </section>
        <section className="panel flush">
          <div className="panelhead">
            <h2>Points requests</h2>
            <span className="count">{q.points.length}</span>
          </div>
          {q.points.map((p) => (
            <details className="decide" key={p.id}>
              <summary>
                <strong>
                  {p.kind === 'earn' ? 'Earn' : 'Redeem'} {Math.abs(p.points)} pts · {p.partner}
                </strong>
                <small>
                  {p.reason}
                  {p.evidence ? ` · ${p.evidence}` : ''}
                </small>
              </summary>
              <DecisionForm action={decidePoints.bind(null, p.id)} options={['Approved', 'Rejected']} />
            </details>
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
              {decided.map((r) => (
                <tr key={r.id}>
                  <td>{r.benefit}</td>
                  <td>{r.partner}</td>
                  <td>
                    <Badge>{r.status}</Badge>
                  </td>
                  <td>{r.decisionNote ?? '—'}</td>
                </tr>
              ))}
              {!decided.length && (
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
    </>
  );
}
