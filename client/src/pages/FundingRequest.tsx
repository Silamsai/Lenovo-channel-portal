import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../auth/AuthContext';
import { api } from '../api/client';
import { useAction } from '../api/hooks';
import { CAMPAIGN_TYPES, QUARTERS, dateLabel, money, quarterLabel, quarterOf } from '../api/format';
import type { Budget, CampaignType, Funding, HistoryEntry, Kit } from '../api/types';
import { Badge, Crumbs, DecisionForm, ErrorText, Kv, Loading, Note, PageHead } from '../components/ui';
import { History } from '../components/History';

type Form = {
  title: string;
  kitId: number | null;
  quarter: string;
  date: string;
  type: CampaignType;
  objective: string;
  eligibleCost: string;
  amount: string;
};

const blank: Form = {
  title: '',
  kitId: null,
  quarter: '2026-Q4',
  date: '2026-11-20',
  type: 'Webinar',
  objective: '',
  eligibleCost: '',
  amount: '',
};

export function FundingRequestPage() {
  const { id } = useParams();
  const isNew = !id;
  const user = useUser();
  const navigate = useNavigate();
  const { run, busy, error, setError } = useAction();

  const detail = useQuery({
    queryKey: ['funding-detail', id],
    queryFn: () => api<{ item: Funding; budget: Budget; history: HistoryEntry[] }>(`/funding/${id}`),
    enabled: !isNew,
  });
  const budgetQ = useQuery({ queryKey: ['budget'], queryFn: () => api<Budget>('/funding/budget'), enabled: isNew });
  const kits = useQuery({ queryKey: ['kits'], queryFn: () => api<Kit[]>('/kits') });

  const item = detail.data?.item;
  const budget = isNew ? budgetQ.data : detail.data?.budget;
  const [form, setForm] = useState<Form>(blank);
  const [attest, setAttest] = useState(false);

  useEffect(() => {
    if (item)
      setForm({
        title: item.title,
        kitId: item.kitId,
        quarter: item.quarter,
        date: item.date,
        type: item.type,
        objective: item.objective,
        eligibleCost: String(item.eligibleCost),
        amount: String(item.amount),
      });
  }, [item]);

  if (!isNew && detail.isLoading) return <Loading />;
  if (!isNew && !item) return <Note>Funding request not found.</Note>;

  const editable = user.role === 'PARTNER' && (isNew || ['Draft', 'Changes requested'].includes(item!.status));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function clientCheck(): string {
    const cost = Number(form.eligibleCost);
    const amount = Number(form.amount);
    if (quarterOf(form.date) !== form.quarter) return 'The execution date must fall within the selected funding quarter.';
    if (!(cost > 0) || !(amount > 0)) return 'Enter the eligible cost and the funding you are requesting.';
    if (amount > cost * 0.5) return 'Requested funding must be at most 50% of eligible cost.';
    if (amount > 15000) return 'Requested funding must be at most £15,000.';
    return '';
  }

  async function save(submit: boolean, e?: FormEvent) {
    e?.preventDefault();
    const problem = clientCheck();
    if (problem) return setError(problem);
    if (submit && !attest) return setError('Confirm that funding approval will be obtained before committing spend.');
    const body = { ...form, eligibleCost: Number(form.eligibleCost), amount: Number(form.amount), submit, attest };
    const saved = await run(
      () => api<Funding>(isNew ? '/funding' : `/funding/${id}`, { method: isNew ? 'POST' : 'PUT', body }),
      submit ? 'Funding request submitted for programme review.' : 'Draft saved.',
    );
    if (saved && isNew) navigate(`/funding/${saved.id}`, { replace: true });
  }

  const status = item?.status ?? 'Draft';
  const code = item?.code ?? 'New request';

  return (
    <>
      <Crumbs items={[['Funding & claims', '/funding'], code]} />
      <PageHead
        title={isNew ? 'Request campaign funding' : item!.title}
        sub={`${code} · Step 1 of the campaign lifecycle`}
        action={<Badge>{status}</Badge>}
      />
      <div className="steps">
        <span className="on">01 Request funding</span>
        <span className={status !== 'Draft' ? 'on' : ''}>02 Funding approval</span>
        <span>03 Run campaign</span>
        <span>04 Performance & POE</span>
        <span>05 Claim</span>
      </div>
      {item?.feedback && <Note>Reviewer feedback: {item.feedback}</Note>}

      <div className="grid">
        <form className="panel" onSubmit={(e) => save(true, e)}>
          <h2>Proposed activity</h2>
          <fieldset disabled={!editable || busy}>
            <div className="field">
              <label htmlFor="f-title">Activity name</label>
              <input id="f-title" required maxLength={100} value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="fields">
              <div className="field">
                <label htmlFor="f-kit">Campaign kit</label>
                <select id="f-kit" value={form.kitId ?? ''} onChange={(e) => set('kitId', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">No kit / own activity</option>
                  {kits.data?.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-type">Campaign type</label>
                <select id="f-type" value={form.type} onChange={(e) => set('type', e.target.value as CampaignType)}>
                  {CAMPAIGN_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-quarter">Funding quarter</label>
                <select id="f-quarter" value={form.quarter} onChange={(e) => set('quarter', e.target.value)}>
                  {QUARTERS.map((q) => (
                    <option key={q} value={q}>
                      {quarterLabel(q)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-date">Planned execution date</label>
                <input id="f-date" type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-objective">Objective and audience</label>
              <textarea id="f-objective" required maxLength={1000} value={form.objective} onChange={(e) => set('objective', e.target.value)} />
            </div>
            <h3>Proposed investment</h3>
            <div className="fields">
              <div className="field">
                <label htmlFor="f-cost">Total eligible activity cost (£)</label>
                <input id="f-cost" type="number" min="1" step="0.01" required value={form.eligibleCost} onChange={(e) => set('eligibleCost', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="f-amount">Requested contribution (£)</label>
                <input id="f-amount" type="number" min="1" max="15000" step="0.01" required value={form.amount} onChange={(e) => set('amount', e.target.value)} />
              </div>
            </div>
            <p className="muted small">
              Up to 50% of eligible cost, at most £15,000, within your available budget
              {budget ? ` (${money(budget.available)})` : ''}.
            </p>
            {editable && (
              <label className="check">
                <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} />I confirm this request is being made before spend is committed.
              </label>
            )}
            <ErrorText>{error}</ErrorText>
            {editable && (
              <div className="actions">
                <button className="btn" type="submit">
                  Submit for review →
                </button>
                <button className="btn secondary" type="button" onClick={() => save(false)}>
                  Save draft
                </button>
              </div>
            )}
          </fieldset>
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
        </form>

        <div>
          <section className="panel">
            <h3>Request summary</h3>
            <Kv k="Partner" v={item?.partner.name ?? user.partner?.name} />
            <Kv k="Requested" v={money(Number(form.amount) || 0)} />
            <Kv k="Quarter" v={quarterLabel(form.quarter)} />
            <Kv k="Execution date" v={dateLabel(form.date)} />
            {budget && <Kv k="Available budget" v={money(budget.available)} />}
            <hr className="rule" />
            {item?.status === 'Approved' && (
              <Link className="btn block" to={`/campaigns/${item.id}/3`}>
                Continue to campaign →
              </Link>
            )}
            {user.role === 'REVIEWER' && item?.status === 'Submitted' && (
              <>
                <h3>Programme decision</h3>
                <p className="muted small">Check eligibility, contribution and available budget. Approval reserves the amount.</p>
                <DecisionForm
                  options={['Approved', 'Changes requested', 'Rejected']}
                  busy={busy}
                  error={error}
                  onDecide={(decision, note) => run(() => api(`/funding/${id}/decision`, { body: { decision, note } }), `Decision recorded: ${decision}.`)}
                />
              </>
            )}
            {user.role === 'PARTNER' && (
              <>
                <h3>What happens next?</h3>
                <p className="muted small">
                  The programme team checks eligibility and budget. After approval you can start the campaign, upload assets and collect evidence.
                </p>
              </>
            )}
          </section>
          {detail.data?.history && <History entries={detail.data.history} />}
        </div>
      </div>
    </>
  );
}
