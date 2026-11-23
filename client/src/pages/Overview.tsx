import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../auth/AuthContext';
import { api } from '../api/client';
import { useFundingList } from '../api/hooks';
import { money, quarterLabel } from '../api/format';
import { campaignStatus, nextStep } from '../api/status';
import type { LearningModule, ReviewQueue } from '../api/types';
import { Badge, Loading, Progress, QuarterSelect } from '../components/ui';
import { brand } from '../config/brand';

export function Overview() {
  const user = useUser();
  return user.role === 'REVIEWER' ? <ReviewerOverview /> : <PartnerOverview />;
}

function PartnerOverview() {
  const user = useUser();
  const [quarter, setQuarter] = useState('all');
  const list = useFundingList(quarter);
  const learning = useQuery({ queryKey: ['enablement'], queryFn: () => api<LearningModule[]>('/enablement') });

  if (list.isLoading) return <Loading />;
  const items = list.data?.items ?? [];
  const approved = items.filter((f) => f.status === 'Approved');
  const active = approved.filter((f) => f.campaign && !f.campaign.claim?.paidAt);
  const reported = approved.filter((f) => f.campaign?.resultsReady);
  const claims = items.map((f) => f.campaign?.claim).filter((c) => c && c.status !== 'Draft' && c.status !== 'Rejected');
  const tasks = items.map((f) => ({ f, step: nextStep(f) })).filter((t) => t.step);
  const lead = tasks[0];
  const modules = learning.data ?? [];
  const doneModules = modules.filter((m) => m.completed).length;

  return (
    <div className="overview">
      <div className="ov-top">
        <div>
          <p className="eyebrow">
            {brand.name} partner workspace
          </p>
          <h1>Overview</h1>
          <p className="sub">Welcome back, {user.partner?.name}.</p>
        </div>
        <div className="ov-tools">
          <QuarterSelect value={quarter} onChange={setQuarter} label="Reporting period" />
          <Link className="btn" to="/funding/new">
            ＋ Request funding
          </Link>
        </div>
      </div>

      <section className="ov-hero">
        <div>
          <span className="ov-kicker">Your next move</span>
          <h2>{lead?.step?.title ?? 'Your quarter is moving forward.'}</h2>
          <p>{lead ? `${lead.f.code} · ${lead.f.title}` : 'Keep an eye on your campaigns, approvals and partner opportunities.'}</p>
          <Link className="ov-hero-link" to={lead?.step?.to ?? '/campaigns'}>
            {lead?.step?.label ?? 'View your campaigns'} →
          </Link>
        </div>
        <div className="ov-hero-aside">
          <span>{brand.journey.join('. ').toUpperCase()}.</span>
          <strong>
            Turn ambition
            <br />
            into impact.
          </strong>
          <p>Funding to performance, all in one workspace.</p>
        </div>
      </section>

      <div className="metrics">
        <MetricLink to="/funding" label="Funding requested" value={money(items.reduce((n, f) => n + f.amount, 0))} note={`${items.length} request${items.length === 1 ? '' : 's'} in this period`} />
        <MetricLink to="/funding" label="Approved funding" value={money(approved.reduce((n, f) => n + f.amount, 0))} note={`${approved.length} approved allocation${approved.length === 1 ? '' : 's'}`} />
        <MetricLink to="/campaigns" label="Active campaigns" value={String(active.length).padStart(2, '0')} note={`${reported.length} with performance recorded`} />
        <MetricLink to="/claims" label="Claims submitted" value={money(claims.reduce((n, c) => n + (c?.amount ?? 0), 0))} note={`${claims.length} claim${claims.length === 1 ? '' : 's'}`} />
      </div>

      <div className="ov-columns">
        <div>
          <section className="panel flush">
            <div className="panelhead">
              <div>
                <h2>Your activity</h2>
                <p className="muted small">Every campaign starts with approved funding.</p>
              </div>
              <Link to="/campaigns">View all →</Link>
            </div>
            <div className="pipeline">
              {[
                ['Funding requests', items.length],
                ['Approved', approved.length],
                ['In execution', active.length],
                ['Results recorded', reported.length],
              ].map(([label, count], i) => (
                <div key={label}>
                  <span>
                    0{i + 1} / {label}
                  </span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Quarter / funding</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.title}</strong>
                        <small>
                          {f.type} · {f.code}
                        </small>
                      </td>
                      <td>
                        {quarterLabel(f.quarter)}
                        <small>{money(f.amount)}</small>
                      </td>
                      <td>
                        <Badge>{campaignStatus(f)}</Badge>
                      </td>
                      <td>
                        <Link to={f.status === 'Approved' ? `/campaigns/${f.id}` : `/funding/${f.id}`}>View →</Link>
                      </td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td colSpan={4}>
                        <strong>A fresh quarter. A new opportunity.</strong>
                        <p className="muted">Start with a funding request to plan your next campaign.</p>
                        <Link to="/funding/new">Request funding →</Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panelhead plain">
              <div>
                <h2>Partner opportunities</h2>
                <p className="muted small">Support for your next stage of growth.</p>
              </div>
            </div>
            <div className="tiles">
              <Link to="/benefits" className="tile">
                <span className="tile-icon">◇</span>
                <h3>Make more of your benefits</h3>
                <p>Explore campaign planning, content review and specialist support.</p>
                <span>Explore benefits →</span>
              </Link>
              <Link to="/rewards" className="tile">
                <span className="tile-icon">☆</span>
                <h3>Put your rewards to work</h3>
                <p>Track approved activity and redeem points for programme support.</p>
                <span>View rewards →</span>
              </Link>
            </div>
          </section>
        </div>

        <div>
          <section className="panel">
            <div className="panelhead plain">
              <h2>Needs your attention</h2>
              <span className="count">{tasks.length}</span>
            </div>
            <div className="tasks">
              {tasks.map(({ f, step }) => (
                <article key={f.id}>
                  <span className="task-type">{step!.tag}</span>
                  <h3>{step!.title}</h3>
                  <p>
                    {f.code} · {f.title}
                  </p>
                  <Link to={step!.to}>{step!.label} →</Link>
                </article>
              ))}
              {!tasks.length && (
                <article>
                  <span className="task-type">Up to date</span>
                  <h3>You’re all caught up.</h3>
                  <p>No outstanding actions in this reporting period.</p>
                </article>
              )}
            </div>
          </section>

          <section className="readiness">
            <span className="task-type light">Campaign readiness</span>
            <h2>Build your team’s confidence.</h2>
            <p>Complete the essentials before your next launch.</p>
            <Progress value={modules.length ? (doneModules / modules.length) * 100 : 0} />
            <div className="readiness-bottom">
              <span>
                {doneModules} of {modules.length} modules
              </span>
              <Link to="/enablement">{doneModules === modules.length ? 'Review learning' : 'Continue learning'} →</Link>
            </div>
          </section>
        </div>
      </div>
      <footer className="page-footer">
        <span>
          {brand.name} {brand.programme.toLowerCase()} · {brand.market} · {brand.currency}
        </span>
      </footer>
    </div>
  );
}

function MetricLink({ to, label, value, note }: { to: string; label: string; value: string; note: string }) {
  return (
    <Link to={to} className="metric link">
      <label>
        {label} <span className="arrow">↗</span>
      </label>
      <strong>{value}</strong>
      <small>{note}</small>
    </Link>
  );
}

function ReviewerOverview() {
  const [quarter, setQuarter] = useState('all');
  const list = useFundingList(quarter);
  const queue = useQuery({ queryKey: ['review-queue'], queryFn: () => api<ReviewQueue>('/reviews/queue') });
  if (list.isLoading || queue.isLoading) return <Loading />;
  const items = list.data?.items ?? [];
  const q = queue.data!;
  const approved = items.filter((f) => f.status === 'Approved');
  const claimsApproved = items.map((f) => f.campaign?.claim).filter((c) => c?.status === 'Approved');
  return (
    <div className="overview">
      <div className="ov-top">
        <div>
          <p className="eyebrow">Programme workspace</p>
          <h1>Programme overview</h1>
          <p className="sub">Funding, campaigns and claims across all partners.</p>
        </div>
        <div className="ov-tools">
          <QuarterSelect value={quarter} onChange={setQuarter} label="Reporting period" />
          <Link className="btn" to="/review">
            Open review queue
          </Link>
        </div>
      </div>
      <div className="metrics">
        <MetricLink to="/review" label="Waiting for decision" value={String(q.funding.length + q.assets.length + q.claims.length)} note={`${q.funding.length} funding · ${q.assets.length} assets · ${q.claims.length} claims`} />
        <MetricLink to="/funding" label="Approved funding" value={money(approved.reduce((n, f) => n + f.amount, 0))} note={`${approved.length} allocations`} />
        <MetricLink to="/claims" label="Claims approved" value={money(claimsApproved.reduce((n, c) => n + (c?.amount ?? 0), 0))} note={`${claimsApproved.length} claims`} />
        <MetricLink to="/review" label="Awaiting payment" value={String(q.payments.length)} note="Approved claims not yet paid" />
      </div>
      <section className="panel flush">
        <div className="panelhead">
          <h2>All activity</h2>
          <Link to="/funding">Funding & claims →</Link>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Partner</th>
                <th>Quarter / funding</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.title}</strong>
                    <small>
                      {f.type} · {f.code}
                    </small>
                  </td>
                  <td>{f.partner.name}</td>
                  <td>
                    {quarterLabel(f.quarter)}
                    <small>{money(f.amount)}</small>
                  </td>
                  <td>
                    <Badge>{campaignStatus(f)}</Badge>
                  </td>
                  <td>
                    <Link to={f.campaign ? `/campaigns/${f.id}` : `/funding/${f.id}`}>View →</Link>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    No submitted activity in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
