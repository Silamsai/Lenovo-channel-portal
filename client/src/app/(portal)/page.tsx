import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { brand } from '@/lib/brand';
import { money, quarterLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { campaignStatus, nextStep } from '@/lib/status';
import type { Budget, Funding, LearningModule, ReviewQueue } from '@/lib/types';
import { Badge, FilterBar, Metric, Progress } from '@/components/ui';

export const metadata = { title: 'Overview' };

type Props = { searchParams: Promise<{ quarter?: string }> };

export default async function OverviewPage({ searchParams }: Props) {
  const user = await requireUser();
  if (user.role === 'ADMIN') redirect('/admin');
  const quarter = (await searchParams).quarter ?? 'all';
  const listPath = `/funding?quarter=${encodeURIComponent(quarter)}`;
  // Fetch everything the page needs at the same time.
  if (user.role === 'REVIEWER') {
    const [list, q] = await Promise.all([apiGet<{ items: Funding[]; budget: Budget | null }>(listPath), apiGet<ReviewQueue>('/reviews/queue')]);
    return <ReviewerOverview items={list.items} quarter={quarter} q={q} />;
  }
  const [list, modules] = await Promise.all([apiGet<{ items: Funding[]; budget: Budget | null }>(listPath), apiGet<LearningModule[]>('/enablement')]);
  return <PartnerOverview items={list.items} quarter={quarter} partnerName={user.partner?.name ?? ''} modules={modules} />;
}

function PartnerOverview({ items, quarter, partnerName, modules }: { items: Funding[]; quarter: string; partnerName: string; modules: LearningModule[] }) {
  const approved = items.filter((f) => f.status === 'Approved');
  const active = approved.filter((f) => f.campaign && !f.campaign.claim?.paidAt);
  const reported = approved.filter((f) => f.campaign?.resultsReady);
  const claims = items.map((f) => f.campaign?.claim).filter((c) => c && c.status !== 'Draft' && c.status !== 'Rejected');
  const tasks = items.map((f) => ({ f, step: nextStep(f) })).filter((t) => t.step);
  const lead = tasks[0];
  const done = modules.filter((m) => m.completed).length;

  return (
    <div className="overview">
      <div className="ov-top">
        <h1 className="visually-hidden">Overview</h1>
        <p className="sub">Welcome back, {partnerName}.</p>
        <div className="ov-tools">
          <FilterBar action="/" quarter={quarter} />
          <Link className="btn" href="/funding/new">
            ＋ Request funding
          </Link>
        </div>
      </div>

      <section className="ov-hero">
        <div>
          <span className="ov-kicker">Your next move</span>
          <h2>{lead?.step?.title ?? 'Your quarter is moving forward.'}</h2>
          <p>{lead ? `${lead.f.code} · ${lead.f.title}` : 'Keep an eye on your campaigns, approvals and partner opportunities.'}</p>
          <Link className="ov-hero-link" href={lead?.step?.to ?? '/campaigns'}>
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
        <Metric href="/funding" label="Funding requested" value={money(items.reduce((n, f) => n + f.amount, 0))} note={`${items.length} request${items.length === 1 ? '' : 's'} in this period`} />
        <Metric href="/funding" label="Approved funding" value={money(approved.reduce((n, f) => n + f.amount, 0))} note={`${approved.length} approved allocation${approved.length === 1 ? '' : 's'}`} />
        <Metric href="/campaigns" label="Active campaigns" value={String(active.length).padStart(2, '0')} note={`${reported.length} with performance recorded`} />
        <Metric href="/claims" label="Claims submitted" value={money(claims.reduce((n, c) => n + (c?.amount ?? 0), 0))} note={`${claims.length} claim${claims.length === 1 ? '' : 's'}`} />
      </div>

      <div className="ov-columns">
        <div>
          <section className="panel flush">
            <div className="panelhead">
              <div>
                <h2>Your activity</h2>
                <p className="muted small">Every campaign starts with approved funding.</p>
              </div>
              <Link href="/campaigns">View all →</Link>
            </div>
            <div className="pipeline">
              {(
                [
                  ['Funding requests', items.length],
                  ['Approved', approved.length],
                  ['In execution', active.length],
                  ['Results recorded', reported.length],
                ] as const
              ).map(([label, count], i) => (
                <div key={label}>
                  <span>
                    0{i + 1} / {label}
                  </span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
            <ActivityTable items={items} showPartner={false} />
          </section>

          <section className="panel">
            <div className="panelhead plain">
              <div>
                <h2>Partner opportunities</h2>
                <p className="muted small">Support for your next stage of growth.</p>
              </div>
            </div>
            <div className="tiles">
              <Link href="/benefits" className="tile">
                <span className="tile-icon">◇</span>
                <h3>Make more of your benefits</h3>
                <p>Explore campaign planning, content review and specialist support.</p>
                <span>Explore benefits →</span>
              </Link>
              <Link href="/rewards" className="tile">
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
                  <Link href={step!.to}>{step!.label} →</Link>
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
            <Progress value={modules.length ? (done / modules.length) * 100 : 0} />
            <div className="readiness-bottom">
              <span>
                {done} of {modules.length} modules
              </span>
              <Link href="/enablement">{done === modules.length ? 'Review learning' : 'Continue learning'} →</Link>
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

function ActivityTable({ items, showPartner }: { items: Funding[]; showPartner: boolean }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Activity</th>
            {showPartner && <th>Partner</th>}
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
              {showPartner && <td>{f.partner.name}</td>}
              <td>
                {quarterLabel(f.quarter)}
                <small>{money(f.amount)}</small>
              </td>
              <td>
                <Badge>{campaignStatus(f)}</Badge>
              </td>
              <td>
                <Link href={f.campaign ? `/campaigns/${f.id}` : `/funding/${f.id}`}>View →</Link>
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={5} className="muted">
                Nothing in this period. <Link href="/funding/new">Request funding →</Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReviewerOverview({ items, quarter, q }: { items: Funding[]; quarter: string; q: ReviewQueue }) {
  const approved = items.filter((f) => f.status === 'Approved');
  const claimsApproved = items.map((f) => f.campaign?.claim).filter((c) => c?.status === 'Approved');
  return (
    <div className="overview">
      <div className="ov-top">
        <h1 className="visually-hidden">Programme overview</h1>
        <span />
        <div className="ov-tools">
          <FilterBar action="/" quarter={quarter} />
          <Link className="btn" href="/review">
            Open review queue
          </Link>
        </div>
      </div>
      <div className="metrics">
        <Metric href="/review" label="Waiting for decision" value={q.funding.length + q.assets.length + q.claims.length} note={`${q.funding.length} funding · ${q.assets.length} assets · ${q.claims.length} claims`} />
        <Metric href="/funding" label="Approved funding" value={money(approved.reduce((n, f) => n + f.amount, 0))} note={`${approved.length} allocations`} />
        <Metric href="/claims" label="Claims approved" value={money(claimsApproved.reduce((n, c) => n + (c?.amount ?? 0), 0))} note={`${claimsApproved.length} claims`} />
        <Metric href="/review" label="Awaiting payment" value={q.payments.length} note="Approved claims not yet paid" />
      </div>
      <section className="panel flush">
        <div className="panelhead">
          <h2>All activity</h2>
          <Link href="/funding">Funding & claims →</Link>
        </div>
        <ActivityTable items={items} showPartner />
      </section>
    </div>
  );
}
