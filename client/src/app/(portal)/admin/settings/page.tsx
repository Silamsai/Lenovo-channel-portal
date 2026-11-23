import { apiGet } from '@/lib/api';
import { saveSettings } from '@/lib/actions';
import { money } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { ProgrammeSettings } from '@/lib/types';
import { Kv, Note, PageHead } from '@/components/ui';
import { ActionForm, Submit } from '@/components/forms';

export const metadata = { title: 'Settings' };

const FIELDS: { key: keyof ProgrammeSettings; label: string; hint: string; type: 'text' | 'number'; step?: string }[] = [
  { key: 'programmeName', label: 'Programme name', hint: 'Shown to partners and reviewers.', type: 'text' },
  { key: 'contributionPercent', label: 'Vendor contribution (%)', hint: 'Max share of eligible cost (requests) and actual spend (claims).', type: 'number', step: '1' },
  { key: 'maxRequestGbp', label: 'Maximum per funding request (£)', hint: 'Upper limit for a single MDF request.', type: 'number', step: '100' },
  { key: 'defaultAnnualBudget', label: 'Default annual budget (£)', hint: 'Given to new partner organisations. Existing ones keep theirs.', type: 'number', step: '100' },
  { key: 'pointsPerActivity', label: 'Points per approved activity', hint: 'Awarded when a reviewer approves a partner’s activity.', type: 'number', step: '1' },
  { key: 'pointsPerApprovedClaim', label: 'Points per approved claim', hint: 'Awarded automatically when a claim is approved.', type: 'number', step: '1' },
];

export default async function AdminSettingsPage() {
  const user = await requireUser('ADMIN');
  const { values, defaults } = await apiGet<{ values: ProgrammeSettings; defaults: ProgrammeSettings }>('/admin/settings');

  return (
    <>
      <PageHead role={user.role} title="Settings" sub="Programme rules used across the partner and reviewer portals." />
      <div className="grid">
        <section className="panel">
          <h2>Programme rules</h2>
          <ActionForm action={saveSettings}>
            <div className="fields">
              {FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label htmlFor={`s-${f.key}`}>{f.label}</label>
                  <input id={`s-${f.key}`} name={f.key} type={f.type} step={f.step} min={f.type === 'number' ? 0 : undefined} required defaultValue={values[f.key]} />
                  <small className="muted">
                    {f.hint} Default: {String(defaults[f.key])}.
                  </small>
                </div>
              ))}
            </div>
            <Submit>Save settings →</Submit>
          </ActionForm>
        </section>
        <div>
          <section className="panel">
            <h3>Current rules</h3>
            <Kv k="Funding request limit" v={`${values.contributionPercent}% of cost, max ${money(values.maxRequestGbp)}`} />
            <Kv k="Claim limit" v={`${values.contributionPercent}% of actual spend`} />
            <Kv k="New organisation budget" v={money(values.defaultAnnualBudget)} />
            <Kv k="Reward points" v={`${values.pointsPerActivity} / ${values.pointsPerApprovedClaim}`} />
          </section>
          <Note>Changes apply to new submissions and decisions. Already approved amounts are not recalculated.</Note>
        </div>
      </div>
    </>
  );
}
