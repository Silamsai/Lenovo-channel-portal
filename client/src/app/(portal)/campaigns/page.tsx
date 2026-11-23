import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { money, quarterLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { campaignStatus, nextStep, stepAllowed } from '@/lib/status';
import type { Budget, Funding } from '@/lib/types';
import { Badge, Crumbs, FilterBar, PageHead } from '@/components/ui';

export const metadata = { title: 'My campaigns' };

const LABELS = ['Request funding', 'Funding approval', 'Run campaign', 'Performance & POE', 'Claim'];

export default async function MyCampaignsPage({ searchParams }: { searchParams: Promise<{ quarter?: string }> }) {
  const user = await requireUser('PARTNER');
  const quarter = (await searchParams).quarter ?? 'all';
  const { items } = await apiGet<{ items: Funding[]; budget: Budget | null }>(`/funding?quarter=${encodeURIComponent(quarter)}`);

  return (
    <>
      <Crumbs items={['My campaigns']} />
      <PageHead
        role={user.role}
        title="My campaigns"
        sub="Every campaign follows the same five steps, from funding request to claim."
        action={
          <Link className="btn" href="/funding/new">
            Request funding →
          </Link>
        }
      />
      <FilterBar action="/campaigns" quarter={quarter}>
        <span className="muted small">Campaigns inherit the quarter of their funding request.</span>
      </FilterBar>
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
                        <Link href={`/campaigns/${f.id}/${i + 1}`}>{l}</Link>
                      </li>
                    ) : (
                      <li key={l} className="muted">
                        {l}
                      </li>
                    ),
                  )}
                </ol>
              </div>
              <Link className="cardfoot" href={next?.to ?? `/campaigns/${f.id}`}>
                {next ? next.label : 'Open campaign'} <span>→</span>
              </Link>
            </article>
          );
        })}
        {!items.length && <div className="panel wide">No campaigns in this quarter.</div>}
      </div>
      <p>
        <Link href="/library">Browse campaign kits →</Link>
      </p>
    </>
  );
}
