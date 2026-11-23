import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../auth/AuthContext';
import { api, downloadFile } from '../api/client';
import { useAction } from '../api/hooks';
import type { Customisation, Kit } from '../api/types';
import { Crumbs, ErrorText, Loading, Note, PageHead } from '../components/ui';
import { brand } from '../config/brand';

const CTAS = ['Register for the webinar', 'Book a conversation', 'Learn more'];

export function Customise() {
  const { slug } = useParams();
  const user = useUser();
  const { run, busy, error } = useAction();
  const q = useQuery({ queryKey: ['kit', slug], queryFn: () => api<{ kit: Kit; customisation: Customisation | null }>(`/kits/${slug}`) });
  const [form, setForm] = useState<Customisation>({ company: '', contactEmail: '', cta: CTAS[0], url: 'https://' });

  useEffect(() => {
    if (!q.data) return;
    setForm(q.data.customisation ?? { company: user.partner?.name ?? '', contactEmail: '', cta: CTAS[0], url: 'https://' });
  }, [q.data, user.partner?.name]);

  if (q.isLoading) return <Loading />;
  if (!q.data) return <Note>Campaign kit not found.</Note>;
  const { kit, customisation } = q.data;
  const set = (k: keyof Customisation, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function save(e: FormEvent) {
    e.preventDefault();
    run(() => api(`/kits/${slug}/customisation`, { method: 'PUT', body: form }), 'Customisation saved.');
  }

  return (
    <>
      <Crumbs items={[['Campaign library', '/library'], [kit.title, `/library/${kit.slug}`], 'Customise']} />
      <PageHead title="Make the campaign yours." sub="Update the permitted fields. Brand elements and approved claims stay locked." />
      <div className="grid">
        <form className="panel" onSubmit={save}>
          <h2>Partner details</h2>
          <div className="field">
            <label htmlFor="c-company">Company name</label>
            <input id="c-company" maxLength={55} required value={form.company} onChange={(e) => set('company', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-email">Contact email</label>
            <input id="c-email" type="email" required value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-cta">Call to action</label>
            <select id="c-cta" value={form.cta} onChange={(e) => set('cta', e.target.value)}>
              {CTAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="c-url">Destination URL</label>
            <input id="c-url" type="url" required value={form.url} onChange={(e) => set('url', e.target.value)} />
          </div>
          <Note>Vendor branding, approved messaging and disclaimers are locked in this template.</Note>
          <ErrorText>{error}</ErrorText>
          <div className="actions">
            <button className="btn" disabled={busy}>
              Save customisation →
            </button>
            {customisation && (
              <button type="button" className="btn secondary" onClick={() => run(() => downloadFile(`/kits/${slug}/export`, 'campaign-copy.txt'), 'Campaign copy downloaded.')}>
                Export campaign copy
              </button>
            )}
          </div>
        </form>
        <div>
          <div className="preview">
            <div className="paper">
              <small>
                {brand.name} / {form.company || 'Your company'}
              </small>
              <h2>{kit.title}</h2>
              <p>Explore the possibilities for your business.</p>
              <div className="line" />
              <div className="line short" />
              <div className="line" />
              <hr className="rule" />
              <strong>{form.cta}</strong>
              <p>
                <small>
                  {form.contactEmail || 'contact@example.com'}
                  <br />
                  {form.url}
                </small>
              </p>
            </div>
          </div>
          <p className="muted small">Live preview · One-pager · A4 portrait</p>
        </div>
      </div>
    </>
  );
}
