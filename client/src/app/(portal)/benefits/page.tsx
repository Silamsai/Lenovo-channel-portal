import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { dateLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { BenefitsData } from '@/lib/types';
import { Badge, Crumbs, Flash, PageHead } from '@/components/ui';

export const metadata = { title: 'Benefits' };

export default async function BenefitsPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const user = await requireUser('PARTNER');
  const data = await apiGet<BenefitsData>('/benefits');
  const sent = (await searchParams).sent;

  return (
    <>
      <Crumbs items={['Benefits']} />
      <PageHead role={user.role} title="Partner benefits" sub="Discover available support and track your requests." />
      <Flash message={sent ? 'Benefit requested. The programme team will review it.' : undefined} />
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
              <Link className="cardfoot" href={`/benefits/${b.id}/request`}>
                Request {b.name.toLowerCase()} <span>→</span>
              </Link>
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
    </>
  );
}
