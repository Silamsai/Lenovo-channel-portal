import { apiGet } from '@/lib/api';
import { requireUser } from '@/lib/session';
import type { Kit } from '@/lib/types';
import { Crumbs, FilterBar, PageHead } from '@/components/ui';
import { AutoSubmitSelect } from '@/components/forms';

export const metadata = { title: 'Campaign library' };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const user = await requireUser('PARTNER', 'REVIEWER');
  const { q = '', type = '' } = await searchParams;
  const all = await apiGet<Kit[]>('/kits');
  const list = all.filter((k) => `${k.title} ${k.description} ${k.type}`.toLowerCase().includes(q.toLowerCase()) && (!type || k.type === type));

  return (
    <>
      <Crumbs items={['Campaign library']} />
      <PageHead role={user.role} title="Campaign library" sub="Approved kits to help you plan, customise and execute your next campaign." />
      <FilterBar action="/library">
        <input name="q" aria-label="Search campaigns" placeholder="Search campaigns, solutions or keywords" defaultValue={q} />
        <AutoSubmitSelect name="type" label="Solution" value={type} options={[['', 'All solutions'], ...[...new Set(all.map((k) => k.type))].map((t) => [t, t] as [string, string])]} />
      </FilterBar>
      <div className="cards">
        {list.map((kit) => (
          <article className="card" key={kit.id}>
            <div className="cardtop">
              <span>{kit.type.toUpperCase()}</span>
              <b>{kit.code}</b>
            </div>
            <div className="cardbody">
              <span className="badge">Campaign kit</span>
              <h3>{kit.title}</h3>
              <p>{kit.description}</p>
              <span className="muted small">
                {kit.assets.length} assets · {kit.market}
              </span>
            </div>
            <a className="cardfoot" href={`/library/${kit.slug}`}>
              Explore campaign <span>↗</span>
            </a>
          </article>
        ))}
        {!list.length && <div className="panel wide">No campaigns match. Try another keyword or solution.</div>}
      </div>
    </>
  );
}
