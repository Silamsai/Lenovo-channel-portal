import { apiGet } from '@/lib/api';
import { requireUser } from '@/lib/session';
import type { Partner } from '@/lib/types';
import { Badge, Crumbs, FilterBar, Metric, PageHead } from '@/components/ui';

export const metadata = { title: 'Partner network' };

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser('REVIEWER');
  const q = (await searchParams).q ?? '';
  const all = await apiGet<Partner[]>('/partners');
  const rows = all.filter((p) => `${p.name} ${p.focus}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <Crumbs items={['Partner network']} />
      <PageHead role={user.role} title="Partner network" sub="Every partner organisation in the programme, with profile, segment and points." />
      <div className="metrics">
        <Metric label="Partners" value={all.length} note="In the programme" />
        <Metric label="Active" value={all.filter((p) => p.status === 'Active').length} note="Ready for programme activity" />
        <Metric label="Invited" value={all.filter((p) => p.status === 'Invited').length} note="Onboarding" />
        <Metric label="Pending benefit requests" value={all.reduce((n, p) => n + (p.pendingBenefits ?? 0), 0)} note="Across partners" />
      </div>
      <FilterBar action="/partners">
        <input name="q" aria-label="Search partners" placeholder="Search partner or solution focus" defaultValue={q} />
      </FilterBar>
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
                    <a href={`/partners/${p.id}`}>View profile →</a>
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
