import { apiGet } from '@/lib/api';
import { saveProfile } from '@/lib/actions';
import { money } from '@/lib/format';
import type { Partner, User } from '@/lib/types';
import { Badge, Crumbs, Kv, PageHead } from './ui';
import { ActionForm, Submit } from './forms';

const FOCUSES = ['ThinkPad workplace', 'ThinkSystem infrastructure', 'ThinkStation creators'];

/** Partner profile: the partner's own (/profile) or any partner for reviewers (/partners/:id). */
export async function PartnerProfile({ user, idKey }: { user: User; idKey: string }) {
  const p = await apiGet<Partner>(`/partners/${idKey}`);
  return (
    <>
      <Crumbs items={user.role === 'REVIEWER' ? [['Partner network', '/partners'], p.name] : ['Our profile']} />
      <PageHead role={user.role} title={p.name} sub={`Business partner profile · ${p.focus}`} action={<Badge>{p.status}</Badge>} />
      <div className="grid">
        <section className="panel">
          <h2>Organisation & contacts</h2>
          <ActionForm action={saveProfile.bind(null, idKey)}>
            <div className="fields">
              <div className="field">
                <label htmlFor="p-name">Organisation name</label>
                <input id="p-name" name="name" required maxLength={80} defaultValue={p.name} />
              </div>
              <div className="field">
                <label htmlFor="p-contact">Primary contact</label>
                <input id="p-contact" name="contact" required maxLength={80} defaultValue={p.contact} />
              </div>
              <div className="field">
                <label htmlFor="p-email">Contact email</label>
                <input id="p-email" name="email" type="email" required defaultValue={p.email} />
              </div>
              <div className="field">
                <label htmlFor="p-focus">Solution focus</label>
                <select id="p-focus" name="focus" defaultValue={p.focus}>
                  {FOCUSES.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="p-goal">Joint business objective</label>
              <textarea id="p-goal" name="goal" required maxLength={500} defaultValue={p.goal} />
            </div>
            <Submit>Save profile →</Submit>
          </ActionForm>
        </section>
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
