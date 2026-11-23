import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../auth/AuthContext';
import { api } from '../api/client';
import { useAction } from '../api/hooks';
import { money } from '../api/format';
import type { Partner } from '../api/types';
import { Badge, Crumbs, ErrorText, Kv, Loading, Note, PageHead } from '../components/ui';

const FOCUSES = ['ThinkPad workplace', 'ThinkSystem infrastructure', 'ThinkStation creators'];

export function PartnerProfile() {
  const { id } = useParams();
  const user = useUser();
  const key = id ?? 'me';
  const q = useQuery({ queryKey: ['partner', key], queryFn: () => api<Partner>(`/partners/${key}`) });
  const { run, busy, error } = useAction();
  const [form, setForm] = useState({ name: '', contact: '', email: '', focus: FOCUSES[0], goal: '' });

  useEffect(() => {
    if (q.data) setForm({ name: q.data.name, contact: q.data.contact, email: q.data.email, focus: q.data.focus, goal: q.data.goal });
  }, [q.data]);

  if (q.isLoading) return <Loading />;
  const p = q.data;
  if (!p) return <Note>Partner not found.</Note>;
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function save(e: FormEvent) {
    e.preventDefault();
    run(() => api(`/partners/${key}`, { method: 'PUT', body: form }), 'Profile saved.');
  }

  return (
    <>
      <Crumbs items={user.role === 'REVIEWER' ? [['Partner network', '/partners'], p.name] : ['Our profile']} />
      <PageHead title={p.name} sub={`Business partner profile · ${p.focus}`} action={<Badge>{p.status}</Badge>} />
      <div className="grid">
        <form className="panel" onSubmit={save}>
          <h2>Organisation & contacts</h2>
          <div className="fields">
            <div className="field">
              <label htmlFor="p-name">Organisation name</label>
              <input id="p-name" required maxLength={80} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="p-contact">Primary contact</label>
              <input id="p-contact" required maxLength={80} value={form.contact} onChange={(e) => set('contact', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="p-email">Contact email</label>
              <input id="p-email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="p-focus">Solution focus</label>
              <select id="p-focus" value={form.focus} onChange={(e) => set('focus', e.target.value)}>
                {FOCUSES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="p-goal">Joint business objective</label>
            <textarea id="p-goal" required maxLength={500} value={form.goal} onChange={(e) => set('goal', e.target.value)} />
          </div>
          <ErrorText>{error}</ErrorText>
          <button className="btn" disabled={busy}>
            Save profile →
          </button>
        </form>
        <section className="panel">
          <h2>Partner access & segment</h2>
          <Kv k="Partner ID" v={p.code} />
          <Kv k="Segment" v={p.segment} />
          <Kv k="Programme owner" v={p.owner} />
          <Kv k="Annual MDF budget" v={money(p.annualBudget)} />
          <Kv k="Reward points" v={p.points.toLocaleString('en-GB')} />
        </section>
      </div>
    </>
  );
}
