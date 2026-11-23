import { apiGet } from '@/lib/api';
import { decideFunding, saveFunding } from '@/lib/actions';
import { CAMPAIGN_TYPES, QUARTERS, dateLabel, money, quarterLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { Budget, Funding, HistoryEntry, Kit, ProgrammeSettings } from '@/lib/types';
import { Badge, Crumbs, History, Kv, Note, PageHead } from '@/components/ui';
import { ActionForm, Submit } from '@/components/forms';
import { DecisionForm } from '@/components/DecisionForm';

/** New request (id = null) or an existing one. Editable by the partner while Draft or Changes requested. */
export async function RequestPage({ id }: { id: number | null }) {
  const user = await requireUser('PARTNER', 'REVIEWER');
  const isNew = id === null;
  if (isNew && user.role !== 'PARTNER') return <Note>Only partners create funding requests.</Note>;
  const [detail, kits, rules, newBudget] = await Promise.all([
    isNew ? null : apiGet<{ item: Funding; budget: Budget; history: HistoryEntry[] }>(`/funding/${id}`),
    apiGet<Kit[]>('/kits'),
    apiGet<ProgrammeSettings>('/settings'),
    isNew ? apiGet<Budget>('/funding/budget') : null,
  ]);
  const item = detail?.item;
  const budget = detail?.budget ?? newBudget;
  const editable = user.role === 'PARTNER' && (isNew || ['Draft', 'Changes requested'].includes(item!.status));
  const status = item?.status ?? 'Draft';
  const code = item?.code ?? 'New request';
  const v = {
    title: item?.title ?? '',
    kitId: item?.kitId ?? '',
    quarter: item?.quarter ?? '2026-Q4',
    date: item?.date ?? '2026-11-20',
    type: item?.type ?? 'Webinar',
    objective: item?.objective ?? '',
    eligibleCost: item?.eligibleCost ?? '',
    amount: item?.amount ?? '',
  };

  return (
    <>
      <Crumbs items={[['Funding & claims', '/funding'], code]} />
      <PageHead role={user.role} title={isNew ? 'Request campaign funding' : item!.title} sub={`${code} · Step 1 of the campaign lifecycle`} action={<Badge>{status}</Badge>} />
      <div className="steps">
        <span className="on">01 Request funding</span>
        <span className={status !== 'Draft' ? 'on' : ''}>02 Funding approval</span>
        <span>03 Run campaign</span>
        <span>04 Performance & POE</span>
        <span>05 Claim</span>
      </div>
      {item?.feedback && <Note>Reviewer feedback: {item.feedback}</Note>}

      <div className="grid">
        <section className="panel">
          <h2>Proposed activity</h2>
          <ActionForm action={saveFunding.bind(null, id)}>
            <fieldset disabled={!editable}>
              <div className="field">
                <label htmlFor="f-title">Activity name</label>
                <input id="f-title" name="title" required maxLength={100} defaultValue={v.title} />
              </div>
              <div className="fields">
                <div className="field">
                  <label htmlFor="f-kit">Campaign kit</label>
                  <select id="f-kit" name="kitId" defaultValue={String(v.kitId)}>
                    <option value="">No kit / own activity</option>
                    {kits.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-type">Campaign type</label>
                  <select id="f-type" name="type" defaultValue={v.type}>
                    {CAMPAIGN_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-quarter">Funding quarter</label>
                  <select id="f-quarter" name="quarter" defaultValue={v.quarter}>
                    {QUARTERS.map((q) => (
                      <option key={q} value={q}>
                        {quarterLabel(q)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-date">Planned execution date</label>
                  <input id="f-date" name="date" type="date" required defaultValue={v.date} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="f-objective">Objective and audience</label>
                <textarea id="f-objective" name="objective" required maxLength={1000} defaultValue={v.objective} />
              </div>
              <h3>Proposed investment</h3>
              <div className="fields">
                <div className="field">
                  <label htmlFor="f-cost">Total eligible activity cost (£)</label>
                  <input id="f-cost" name="eligibleCost" type="number" min="1" step="0.01" required defaultValue={v.eligibleCost} />
                </div>
                <div className="field">
                  <label htmlFor="f-amount">Requested contribution (£)</label>
                  <input id="f-amount" name="amount" type="number" min="1" max={rules.maxRequestGbp} step="0.01" required defaultValue={v.amount} />
                </div>
              </div>
              <p className="muted small">
                Up to {rules.contributionPercent}% of eligible cost, at most {money(rules.maxRequestGbp)}, within your available budget
                {budget ? ` (${money(budget.available)})` : ''}.
              </p>
              {editable && (
                <>
                  <label className="check">
                    <input type="checkbox" name="attest" />I confirm this request is being made before spend is committed.
                  </label>
                  <div className="actions">
                    <Submit value="submit">Submit for review →</Submit>
                    <Submit value="draft" secondary>
                      Save draft
                    </Submit>
                  </div>
                </>
              )}
            </fieldset>
          </ActionForm>
          {!editable && item && (
            <Note>
              {item.status === 'Submitted'
                ? 'Submitted for programme review.'
                : item.status === 'Approved'
                  ? 'Funding approved. Continue to the campaign to run the activity.'
                  : item.status === 'Rejected'
                    ? 'Request rejected. The decision is kept in the history.'
                    : 'Read only.'}
            </Note>
          )}
        </section>

        <div>
          <section className="panel">
            <h3>Request summary</h3>
            <Kv k="Partner" v={item?.partner.name ?? user.partner?.name} />
            {item && <Kv k="Requested" v={money(item.amount)} />}
            <Kv k="Quarter" v={quarterLabel(v.quarter)} />
            <Kv k="Execution date" v={dateLabel(v.date)} />
            {budget && <Kv k="Available budget" v={money(budget.available)} />}
            <hr className="rule" />
            {item?.status === 'Approved' && (
              <a className="btn block" href={`/campaigns/${item.id}/3`}>
                Continue to campaign →
              </a>
            )}
            {user.role === 'REVIEWER' && item?.status === 'Submitted' && (
              <>
                <h3>Programme decision</h3>
                <p className="muted small">Check eligibility, contribution and available budget. Approval reserves the amount.</p>
                <DecisionForm action={decideFunding.bind(null, item.id)} options={['Approved', 'Changes requested', 'Rejected']} />
              </>
            )}
            {user.role === 'PARTNER' && (
              <>
                <h3>What happens next?</h3>
                <p className="muted small">The programme team checks eligibility and budget. After approval you can start the campaign, upload assets and collect evidence.</p>
              </>
            )}
          </section>
          {detail?.history && <History entries={detail.history} />}
        </div>
      </div>
    </>
  );
}
