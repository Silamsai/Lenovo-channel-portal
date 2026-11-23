import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Kit } from '../api/types';
import { Crumbs, Loading, PageHead } from '../components/ui';

export function KitCard({ kit }: { kit: Kit }) {
  return (
    <article className="card">
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
      <Link className="cardfoot" to={`/library/${kit.slug}`}>
        Explore campaign <span>↗</span>
      </Link>
    </article>
  );
}

export function CampaignLibrary() {
  const kits = useQuery({ queryKey: ['kits'], queryFn: () => api<Kit[]>('/kits') });
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  if (kits.isLoading) return <Loading />;
  const all = kits.data ?? [];
  const list = all.filter((k) => `${k.title} ${k.description} ${k.type}`.toLowerCase().includes(q.toLowerCase()) && (!type || k.type === type));
  return (
    <>
      <Crumbs items={['Campaign library']} />
      <PageHead title="Campaign library" sub="Approved kits to help you plan, customise and execute your next campaign." />
      <div className="filters">
        <input aria-label="Search campaigns" placeholder="Search campaigns, solutions or keywords" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by solution" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All solutions</option>
          {[...new Set(all.map((k) => k.type))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="cards">
        {list.map((k) => (
          <KitCard key={k.id} kit={k} />
        ))}
        {!list.length && <div className="panel wide">No campaigns match. Try another keyword or solution.</div>}
      </div>
    </>
  );
}
