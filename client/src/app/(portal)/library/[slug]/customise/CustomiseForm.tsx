'use client';

import { useState } from 'react';
import type { FormState } from '@/lib/actions';
import type { Customisation } from '@/lib/types';
import { ActionForm, Submit } from '@/components/forms';

const CTAS = ['Register for the webinar', 'Book a conversation', 'Learn more'];

/** Customise form with a live one-pager preview (the only part of this page that needs JavaScript). */
export function CustomiseForm({
  action,
  initial,
  brandName,
  kitTitle,
  exportHref,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial: Customisation;
  brandName: string;
  kitTitle: string;
  exportHref: string | null;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof Customisation) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid">
      <section className="panel">
        <h2>Partner details</h2>
        <ActionForm action={action}>
          <div className="field">
            <label htmlFor="c-company">Company name</label>
            <input id="c-company" name="company" maxLength={55} required value={form.company} onChange={set('company')} />
          </div>
          <div className="field">
            <label htmlFor="c-email">Contact email</label>
            <input id="c-email" name="contactEmail" type="email" required value={form.contactEmail} onChange={set('contactEmail')} />
          </div>
          <div className="field">
            <label htmlFor="c-cta">Call to action</label>
            <select id="c-cta" name="cta" value={form.cta} onChange={set('cta')}>
              {CTAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="c-url">Destination URL</label>
            <input id="c-url" name="url" type="url" required value={form.url} onChange={set('url')} />
          </div>
          <div className="note">Vendor branding, approved messaging and disclaimers are locked in this template.</div>
          <div className="actions">
            <Submit>Save customisation →</Submit>
            {exportHref && (
              <a className="btn secondary" href={exportHref}>
                Export campaign copy
              </a>
            )}
          </div>
        </ActionForm>
      </section>
      <div>
        <div className="preview">
          <div className="paper">
            <small>
              {brandName} / {form.company || 'Your company'}
            </small>
            <h2>{kitTitle}</h2>
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
  );
}
