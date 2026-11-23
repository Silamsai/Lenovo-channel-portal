import type { ReactNode } from 'react';
import { apiGet } from '@/lib/api';
import { dateLabel, money, quarterLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { Funding, ReviewQueue } from '@/lib/types';
import { Badge, Crumbs, Kv, PageHead } from '@/components/ui';

export const metadata = { title: 'Review queue' };

function Section({ title, items, render, empty }: { title: string; items: Funding[]; render: (f: Funding) => ReactNode; empty: string }) {
  return (
    <section className="panel flush">
      <div className="panelhead">
        <h2>{title}</h2>
        <span className="count">{items.length}</span>
      </div>
      {items.length ? items.map(render) : <p className="muted pad">{empty}</p>}
    </section>
  );
}

export default async function ReviewQueuePage() {
  const user = await requireUser('REVIEWER');
  const data = await apiGet<ReviewQueue>('/reviews/queue');

  return (
    <>
      <Crumbs items={['Review queue']} />
      <PageHead role={user.role} title="Review queue" sub="Funding requests, campaign assets and claims waiting for a programme decision." />
      <div className="grid">
        <div>
          <Section
            title="Funding requests"
            items={data.funding}
            empty="No funding requests waiting."
            render={(f) => (
              <div className="task" key={f.id}>
                <span className="num">£</span>
                <div>
                  <strong>
                    {f.code} · {f.title}
                  </strong>
                  <p>
                    {f.partner.name} · {quarterLabel(f.quarter)} · {money(f.amount)} requested · {money((f as Funding & { available: number }).available)} available
                  </p>
                </div>
                <a href={`/funding/${f.id}`}>Review →</a>
              </div>
            )}
          />
          <Section
            title="Campaign assets"
            items={data.assets}
            empty="No assets waiting."
            render={(f) => (
              <div className="task" key={f.id}>
                <span className="num">▦</span>
                <div>
                  <strong>
                    {f.title} · version {f.campaign?.assetVersion}
                  </strong>
                  <p>
                    {f.partner.name} · {f.campaign?.assets.length} file(s)
                  </p>
                </div>
                <a href={`/campaigns/${f.id}/3`}>Review →</a>
              </div>
            )}
          />
          <Section
            title="Claims"
            items={data.claims}
            empty="No claims waiting."
            render={(f) => (
              <div className="task" key={f.id}>
                <span className="num">✓</span>
                <div>
                  <strong>
                    {f.campaign?.claim?.code} · {f.title}
                  </strong>
                  <p>
                    {f.partner.name} · {money(f.campaign?.claim?.amount)} claimed of {money(f.amount)} approved
                  </p>
                </div>
                <a href={`/campaigns/${f.id}/5`}>Review →</a>
              </div>
            )}
          />
          <Section
            title="Approved claims awaiting payment"
            items={data.payments}
            empty="Nothing to pay."
            render={(f) => (
              <div className="task" key={f.id}>
                <span className="num">£</span>
                <div>
                  <strong>
                    {f.campaign?.claim?.code} · {f.title}
                  </strong>
                  <p>
                    {f.partner.name} · {money(f.campaign?.claim?.amount)} · approved {dateLabel(f.campaign?.claim?.decidedAt)}
                  </p>
                </div>
                <a href={`/campaigns/${f.id}/5`}>Record payment →</a>
              </div>
            )}
          />
        </div>
        <section>
          <div className="panel">
            <h3>Review checklist</h3>
            <div className="check">01 &nbsp; Partner and activity are eligible.</div>
            <div className="check">02 &nbsp; Amount is within approved limits.</div>
            <div className="check">03 &nbsp; Evidence is complete and dated.</div>
            <div className="check">04 &nbsp; Decision and reason are recorded.</div>
          </div>
          <div className="panel">
            <h3>Partner programme</h3>
            <Kv k="Benefit requests" v={<Badge>{`${data.benefits.length} pending`}</Badge>} />
            <Kv k="Points requests" v={<Badge>{`${data.points.length} pending`}</Badge>} />
            <a className="btn secondary spaced" href="/administration">
              Open administration →
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
