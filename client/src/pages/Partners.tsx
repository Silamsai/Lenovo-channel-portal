import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Partner } from '../api/types';
import { Badge, Crumbs, Loading, Metric, PageHead } from '../components/ui';

export function Partners() {
  const q = useQuery({ queryKey: ['partners'], queryFn: () => api<Partner[]>('/partners') });
  const [search, setSearch] = useState('');
  if (q.isLoading) return <Loading />;
  const all = q.data ?? [];
  const rows = all.filter((p) => `${p.name} ${p.focus}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <Crumbs items={['Partner network']} />
      <PageHead title="Partner network" sub="Every partner organisation in the programme, with profile, segment and points." />
      <div className="metrics">
        <Metric label="Partners" value={all.length} note="In the programme" />
        <Metric label="Active" value={all.filter((p) => p.status === 'Active').length} note="Ready for programme activity" />
        <Metric label="Invited" value={all.filter((p) => p.status === 'Invited').length} note="Onboarding" />
        <Metric label="Pending benefit requests" value={all.reduce((n, p) => n + (p.pendingBenefits ?? 0), 0)} note="Across partners" />
      </div>
      <div className="filters">
        <input aria-label="Search partners" placeholder="Search partner or solution focus" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <section className="panel flush">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Partner</th>
                <th>Solution focus</th>
                <th>Segment</th>
                <th>Points</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>
                      {p.code} · owner {p.owner}
                    </small>
                  </td>
                  <td>{p.focus}</td>
                  <td>{p.segment}</td>
                  <td>{p.points.toLocaleString('en-GB')}</td>
                  <td>
                    <Badge>{p.status}</Badge>
                  </td>
                  <td>
                    <Link to={`/partners/${p.id}`}>View profile →</Link>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="muted">
                    No matching partners.
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
