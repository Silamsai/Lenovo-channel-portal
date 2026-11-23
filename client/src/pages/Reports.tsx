import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../auth/AuthContext';
import { api, downloadFile } from '../api/client';
import { money, quarterLabel } from '../api/format';
import type { Report } from '../api/types';
import { Badge, Crumbs, Loading, Metric, Note, PageHead, Progress, QuarterSelect } from '../components/ui';

export function Reports() {
  const user = useUser();
  const [quarter, setQuarter] = useState('all');
  const q = useQuery({ queryKey: ['reports', quarter], queryFn: () => api<Report>(`/reports?quarter=${quarter}`) });
  if (q.isLoading) return <Loading />;
  const r = q.data!;
  const isReviewer = user.role === 'REVIEWER';

  return (
    <>
      <Crumbs items={['Reports']} />
      <PageHead
        title="Programme performance"
        sub="Operational reporting. Partner-reported results are shown separately from platform activity."
        action={
          <button className="btn secondary" onClick={() => downloadFile(`/reports/export.csv?quarter=${quarter}`, 'channel-report.csv')}>
            Export CSV
          </button>
        }
      />
      <div className="filters">
        <QuarterSelect value={quarter} onChange={setQuarter} />
      </div>
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
