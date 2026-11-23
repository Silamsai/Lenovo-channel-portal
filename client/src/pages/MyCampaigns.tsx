import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFundingList } from '../api/hooks';
import { money, quarterLabel } from '../api/format';
import { campaignStatus, nextStep, stepAllowed } from '../api/status';
import { Badge, Crumbs, Loading, PageHead, QuarterSelect } from '../components/ui';

const LABELS = ['Request funding', 'Funding approval', 'Run campaign', 'Performance & POE', 'Claim'];

export function MyCampaigns() {
  const [quarter, setQuarter] = useState('all');
  const list = useFundingList(quarter);
  if (list.isLoading) return <Loading />;
  const items = list.data?.items ?? [];

  return (
    <>
      <Crumbs items={['My campaigns']} />
      <PageHead
        title="My campaigns"
        sub="Every campaign follows the same five steps, from funding request to claim."
        action={
          <Link className="btn" to="/funding/new">
            Request funding →
          </Link>
        }
      />
      <div className="filters">
        <QuarterSelect value={quarter} onChange={setQuarter} />
        <span className="muted small">Campaigns inherit the quarter of their funding request.</span>
      </div>
      <div className="cards">
        {items.map((f) => {
          const next = nextStep(f);
          return (
            <article className="card" key={f.id}>
              <div className="cardbody">
                <p className="eyebrow">
                  {quarterLabel(f.quarter)} · {f.code}
                </p>
                <h3>{f.title}</h3>
                <p className="muted">
                  {f.type} · {money(f.amount)}
                </p>
                <Badge>{campaignStatus(f)}</Badge>
                <ol className="journey-list">
                  {LABELS.map((l, i) =>
                    stepAllowed(f, i + 1) ? (
                      <li key={l}>
                        <Link to={`/campaigns/${f.id}/${i + 1}`}>{l}</Link>
                      </li>
                    ) : (
                      <li key={l} className="muted">
                        {l}
                      </li>
                    ),
                  )}
                </ol>
              </div>
              <Link className="cardfoot" to={next?.to ?? `/campaigns/${f.id}`}>
                {next ? `${next.label}` : 'Open campaign'} <span>→</span>
              </Link>
            </article>
          );
        })}
        {!items.length && <div className="panel wide">No campaigns in this quarter.</div>}
      </div>
      <p>
        <Link to="/library">Browse campaign kits →</Link>
      </p>
    </>
  );
}
