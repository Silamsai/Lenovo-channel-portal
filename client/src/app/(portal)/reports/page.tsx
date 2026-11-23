import { apiGet } from '@/lib/api';
import { money, quarterLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { Report } from '@/lib/types';
import { Badge, Crumbs, FilterBar, Metric, Note, PageHead, Progress } from '@/components/ui';

export const metadata = { title: 'Reports' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ quarter?: string }> }) {
  const user = await requireUser('PARTNER', 'REVIEWER');
  const quarter = (await searchParams).quarter ?? 'all';
  const r = await apiGet<Report>(`/reports?quarter=${encodeURIComponent(quarter)}`);
  const isReviewer = user.role === 'REVIEWER';

  return (
    <>
      <Crumbs items={['Reports']} />
      <PageHead
        role={user.role}
        title="Programme performance"
        sub="Operational reporting. Partner-reported results are shown separately from platform activity."
        action={
          <a className="btn secondary" href={`/download/reports/export.csv?quarter=${encodeURIComponent(quarter)}`}>
            Export CSV
          </a>
        }
      />
      <FilterBar action="/reports" quarter={quarter} />
      <div className="metrics">
        <Metric label="Campaign kit exports" value={r.totals.kitExports} note="Platform-observed activity" />
        <Metric label="Campaigns launched" value={r.totals.launched} note={`${r.totals.completed} completed`} />
        <Metric label="Claims approved" value={money(r.totals.claimsApproved)} note={`of ${money(r.totals.approved)} approved funding`} />
        <Metric label="Payment reported" value={money(r.totals.paid)} note="Recorded finance handoff" />
      </div>

      <section className="panel flush">
        <div className="panelhead">
          <h2>Campaign performance by quarter</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                {isReviewer && <th>Partner</th>}
                <th>Funding / quarter</th>
                <th>Recorded performance</th>
                <th>Claim</th>
              </tr>
            </thead>
            <tbody>
              {r.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.title}
                    <small>{c.type}</small>
                  </td>
                  {isReviewer && <td>{c.partner}</td>}
                  <td>
                    {c.code}
                    <small>{quarterLabel(c.quarter)}</small>
                  </td>
                  <td>
                    {c.resultsReady ? (
                      c.metrics.map((m) => (
                        <div key={m.label} className="small">
                          {m.label}: <strong>{m.value}</strong>
                        </div>
                      ))
                    ) : (
                      <Badge>Results missing</Badge>
                    )}
                  </td>
                  <td>
                    {c.claimStatus ? <Badge>{c.paid ? 'Paid' : c.claimStatus}</Badge> : '—'}
                    {c.claimAmount !== null && <small>{money(c.claimAmount)}</small>}
                  </td>
                </tr>
              ))}
              {!r.campaigns.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    No campaigns in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Campaign readiness</h2>
        <p className="muted small">Share of steps done: assets approved, results recorded, evidence complete, claim submitted.</p>
        {r.campaigns.map((c) => (
          <div key={c.id} className="readiness-row">
            <div className="kv">
              <strong>{c.title}</strong>
              <span>{c.readiness}%</span>
            </div>
            <Progress value={c.readiness} />
          </div>
        ))}
      </section>
      <Note>Pipeline, revenue attribution and currency conversion are outside this portal’s scope.</Note>
    </>
  );
}
