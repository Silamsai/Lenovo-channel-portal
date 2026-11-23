import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../auth/AuthContext';
import { api, downloadFile, uploadFiles } from '../api/client';
import { useAction } from '../api/hooks';
import { EVIDENCE, dateLabel, money, quarterLabel } from '../api/format';
import { stepAllowed } from '../api/status';
import type { Funding, HistoryEntry } from '../api/types';
import { Badge, Check, Crumbs, DecisionForm, ErrorText, FileRows, Kv, Loading, Note, PageHead, UploadButton, useToast } from '../components/ui';
import { History } from '../components/History';

const LABELS = ['Request funding', 'Funding approval', 'Run campaign', 'Performance & POE', 'Claim'];
const LOCKED = ['Submitted', 'Approved', 'Rejected'];

type Histories = { funding: HistoryEntry[]; assets: HistoryEntry[]; claim: HistoryEntry[] };

export function CampaignJourney() {
  const { fid, step: stepParam } = useParams();
  const navigate = useNavigate();
  const funding = useQuery({
    queryKey: ['funding-detail', fid],
    queryFn: () => api<{ item: Funding; history: HistoryEntry[] }>(`/funding/${fid}`),
  });
  const item = funding.data?.item;
  const campaignDetail = useQuery({
    queryKey: ['campaign-detail', fid],
    queryFn: () => api<{ item: Funding; history: Histories }>(`/campaigns/${fid}`),
    enabled: !!item?.campaign,
  });

  if (funding.isLoading) return <Loading />;
  if (!item) return <Note>Campaign not found.</Note>;

  const defaultStep = item.status !== 'Approved' ? (item.status === 'Draft' ? 1 : 2) : !item.campaign || !item.campaign.assetsApproved ? 3 : 4;
  let step = Number(stepParam) || defaultStep;
  if (!stepAllowed(item, step)) step = defaultStep;
  const histories = campaignDetail.data?.history;
  const go = (n: number) => navigate(`/campaigns/${fid}/${n}`);

  return (
    <>
      <Crumbs items={[['My campaigns', '/campaigns'], item.title]} />
      <PageHead
        title={item.title}
        sub={`${item.code} · ${quarterLabel(item.quarter)} · ${item.type}${item.partner ? ' · ' + item.partner.name : ''}`}
        action={
          <Link className="btn secondary" to="/campaigns">
            All campaigns
          </Link>
        }
      />
      <div className="journey-rail" aria-label="Campaign steps">
        {LABELS.map((label, i) => (
          <button key={label} className={step === i + 1 ? 'current' : ''} disabled={!stepAllowed(item, i + 1)} onClick={() => go(i + 1)}>
            <span>0{i + 1}</span>
            {label}
          </button>
        ))}
      </div>
      {step === 1 && <StepRequest item={item} />}
      {step === 2 && <StepApproval item={item} history={funding.data!.history} onNext={() => go(3)} />}
      {step === 3 && <StepAssets item={item} history={histories?.assets ?? []} onNext={() => go(4)} />}
      {step === 4 && <StepPerformance item={item} onNext={() => go(5)} />}
      {step === 5 && <StepClaim item={item} history={histories?.claim ?? []} onBack={() => go(4)} />}
    </>
  );
}

// ---------- 01 Request ----------

function StepRequest({ item }: { item: Funding }) {
  return (
    <section className="panel">
      <h2>Funding request {item.code}</h2>
      <Kv k="Activity" v={item.title} />
      <Kv k="Quarter" v={quarterLabel(item.quarter)} />
      <Kv k="Campaign type" v={item.type} />
      <Kv k="Execution date" v={dateLabel(item.date)} />
      <Kv k="Eligible cost" v={money(item.eligibleCost)} />
      <Kv k="Requested" v={money(item.amount)} />
      <Kv k="Status" v={<Badge>{item.status}</Badge>} />
      <p className="muted">{item.objective}</p>
      <Link className="btn secondary" to={`/funding/${item.id}`}>
        Open funding request →
      </Link>
    </section>
  );
}

// ---------- 02 Approval ----------

function StepApproval({ item, history, onNext }: { item: Funding; history: HistoryEntry[]; onNext: () => void }) {
  const user = useUser();
  const { run, busy, error } = useAction();
  return (
    <div className="grid">
      <section className="panel">
        <h2>Funding approval</h2>
        <Kv k="Request" v={item.code} />
        <Kv k="Amount" v={money(item.amount)} />
        <Kv k="Status" v={<Badge>{item.status}</Badge>} />
        {item.feedback && <Note>Reviewer feedback: {item.feedback}</Note>}
        <div className="actions spaced">
          {item.status === 'Approved' ? (
            <button className="btn" onClick={onNext}>
              Continue to run campaign →
            </button>
          ) : (
            <Link className="btn secondary" to={`/funding/${item.id}`}>
              View funding request
            </Link>
          )}
        </div>
        {user.role === 'REVIEWER' && item.status === 'Submitted' && (
          <>
            <hr className="rule" />
            <DecisionForm
              options={['Approved', 'Changes requested', 'Rejected']}
              busy={busy}
              error={error}
              onDecide={(decision, note) => run(() => api(`/funding/${item.id}/decision`, { body: { decision, note } }), `Decision recorded: ${decision}.`)}
            />
          </>
        )}
        <p className="muted small">Funding approval is required before running the campaign.</p>
      </section>
      <History entries={history} />
    </div>
  );
}

// ---------- 03 Run campaign: assets ----------

function StepAssets({ item, history, onNext }: { item: Funding; history: HistoryEntry[]; onNext: () => void }) {
  const user = useUser();
  const isPartner = user.role === 'PARTNER';
  const { run, busy, error } = useAction();
  const c = item.campaign;

  if (!c) {
    return (
      <section className="panel">
        <h2>Start your funded campaign</h2>
        <p>
          Funding {item.code} is approved for {money(item.amount)}. Starting the campaign creates claim records and opens asset approval, performance and
          evidence.
        </p>
        <ErrorText>{error}</ErrorText>
        {isPartner ? (
          <button className="btn" disabled={busy} onClick={() => run(() => api(`/funding/${item.id}/start`, { method: 'POST' }), 'Campaign started.')}>
            Start funded campaign →
          </button>
        ) : (
          <p className="muted">The partner has not started this campaign yet.</p>
        )}
      </section>
    );
  }

  const claimLocked = LOCKED.includes(c.claim?.status ?? '');
  const canEdit = isPartner && c.assetStatus !== 'Submitted' && !claimLocked;
  const base = `/campaigns/${item.id}`;

  return (
    <>
      <Note>Upload your final campaign creative and request approval. The approved version carries forward to performance, POE and the claim.</Note>
      <div className="grid">
        <section className="panel">
          <div className="panelhead plain">
            <h2>Campaign assets</h2>
            <Badge>{c.assetStatus}</Badge>
          </div>
          <p className="muted small">
            Version {c.assetVersion} · {c.assets.length} file(s). Changing approved files starts a new version that needs approval again.
          </p>
          {c.assetNote && <Note>{c.assetNote}</Note>}
          <FileRows
            files={c.assets}
            onDownload={(f) => downloadFile(`${base}/files/${f.id}`, f.name)}
            onRemove={canEdit ? (f) => run(() => api(`${base}/assets/${f.id}`, { method: 'DELETE' }), 'File removed.') : undefined}
          />
          <ErrorText>{error}</ErrorText>
          <div className="actions spaced">
            {canEdit && <UploadButton label="Add campaign assets" disabled={busy} onFiles={(files) => run(() => uploadFiles(`${base}/assets`, files), 'Assets uploaded.')} />}
            {isPartner && ['Draft', 'Changes requested'].includes(c.assetStatus) && !claimLocked && (
              <button className="btn" disabled={busy || !c.assets.length} onClick={() => run(() => api(`${base}/assets/submit`, { method: 'POST' }), 'Assets submitted for approval.')}>
                Submit for approval
              </button>
            )}
            {c.assetsApproved && (
              <button className="btn" onClick={onNext}>
                Continue to performance & POE →
              </button>
            )}
          </div>
          {!isPartner && c.assetStatus === 'Submitted' && (
            <>
              <hr className="rule" />
              <h3>Review assets</h3>
              <DecisionForm
                options={['Approved', 'Changes requested']}
                busy={busy}
                error={error}
                onDecide={(decision, note) => run(() => api(`${base}/assets/decision`, { body: { decision, note } }), `Assets: ${decision}.`)}
              />
            </>
          )}
        </section>
        <History entries={history} title="Version & decision history" />
      </div>
    </>
  );
}

// ---------- 04 Performance & POE ----------

function StepPerformance({ item, onNext }: { item: Funding; onNext: () => void }) {
  const user = useUser();
  const isPartner = user.role === 'PARTNER';
  const toast = useToast();
  const { run, busy, error } = useAction();
  const files = useAction();
  const c = item.campaign!;
  const locked = !isPartner || LOCKED.includes(c.claim?.status ?? '');
  const base = `/campaigns/${item.id}`;
  const [values, setValues] = useState<Record<string, string>>({});
  const [spend, setSpend] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setValues(Object.fromEntries(c.metricFields.map(([k]) => [k, c.metrics[k] !== undefined ? String(c.metrics[k]) : ''])));
    setSpend(c.actualSpend !== null ? String(c.actualSpend) : '');
  }, [c.metrics, c.actualSpend, c.metricFields]);

  function save(e: FormEvent) {
    e.preventDefault();
    const complete = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'complete';
    run(() => api(`${base}/performance`, { method: 'PUT', body: { metrics: values, spend, complete } }), complete ? 'Campaign completed with all results.' : 'Performance saved.');
  }

  async function exportPack(type: 'pptx' | 'zip') {
    setExporting(true);
    try {
      await downloadFile(`${base}/export?type=${type}`, `POE.${type}`);
      toast('POE pack downloaded.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Note>Results are required to complete the campaign and submit its claim. Counts are unique people or actions. Enter 0 for a measured zero.</Note>
      <div className="grid">
        <form className="panel" onSubmit={save}>
          <h2>Campaign performance</h2>
          <fieldset disabled={locked || busy}>
            <div className="fields">
              {c.metricFields.map(([k, label]) => (
                <div className="field" key={k}>
                  <label htmlFor={`m-${k}`}>{label} *</label>
                  <input id={`m-${k}`} type="number" min="0" step="1" required value={values[k] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="field">
                <label htmlFor="m-spend">Actual eligible spend (£) *</label>
                <input id="m-spend" type="number" min="0" step="0.01" required value={spend} onChange={(e) => setSpend(e.target.value)} />
              </div>
            </div>
            <ErrorText>{error}</ErrorText>
            {!locked && (
              <div className="actions">
                <button className="btn" value="save">
                  Save performance
                </button>
                <button className="btn secondary" value="complete">
                  Complete campaign
                </button>
              </div>
            )}
          </fieldset>
          {locked && isPartner && <p className="muted small">Performance is locked with the submitted claim.</p>}
        </form>
        <section className="panel">
          <h2>Funding & reporting</h2>
          <Kv k="Approved request" v={item.code} />
          <Kv k="Quarter" v={quarterLabel(item.quarter)} />
          <Kv k="Execution date" v={dateLabel(item.date)} />
          <Kv k="Approved allocation" v={money(item.amount)} />
          <Kv k="Performance" v={<Badge>{c.resultsReady ? 'Recorded' : 'Missing'}</Badge>} />
          <Kv k="Campaign" v={c.completedAt ? 'Completed' : 'In progress'} />
          <p className="muted small">Contribution: 50% of actual eligible spend, capped at the approved allocation.</p>
        </section>
      </div>

      <section className="panel">
        <h2>Proof of execution</h2>
        <p className="muted small">Approved creative carries forward from step 03. Attach the remaining evidence. Maximum 25 MB per file and 100 MB per campaign.</p>
        <Kv k="Approved campaign assets" v={`${c.assets.length} file(s) · v${c.assetVersion}`} />
        {EVIDENCE.map(({ kind, label }) => (
          <div className="poe-category" key={kind}>
            <div className="panelhead plain">
              <h3>{label}</h3>
              <Badge>{c.evidence[kind].length ? 'Attached' : 'Required'}</Badge>
            </div>
            <FileRows
              files={c.evidence[kind]}
              onDownload={(f) => downloadFile(`${base}/files/${f.id}`, f.name)}
              onRemove={!locked ? (f) => files.run(() => api(`${base}/evidence/${f.id}`, { method: 'DELETE' }), 'File removed.') : undefined}
            />
            {!locked && <UploadButton label={`Add ${label.toLowerCase()}`} disabled={files.busy} onFiles={(fl) => files.run(() => uploadFiles(`${base}/evidence/${kind}`, fl), 'Evidence uploaded.')} />}
          </div>
        ))}
        <ErrorText>{files.error}</ErrorText>
        <div className="actions spaced">
          <button className="btn secondary" disabled={exporting} onClick={() => exportPack('pptx')}>
            Download PowerPoint
          </button>
          <button className="btn secondary" disabled={exporting} onClick={() => exportPack('zip')}>
            Download POE ZIP
          </button>
          <button className="btn" onClick={onNext}>
            Continue to claim →
          </button>
        </div>
      </section>
    </>
  );
}

// ---------- 05 Claim ----------

function StepClaim({ item, history, onBack }: { item: Funding; history: HistoryEntry[]; onBack: () => void }) {
  const user = useUser();
  const isPartner = user.role === 'PARTNER';
  const { run, busy, error, setError } = useAction();
  const c = item.campaign!;
  const claim = c.claim!;
  const locked = LOCKED.includes(claim.status);
  const [amount, setAmount] = useState('');
  const [attested, setAttested] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setAmount(String(claim.amount ?? claim.limit));
    setAttested(claim.attested);
  }, [claim.amount, claim.limit, claim.attested]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const doSubmit = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value !== 'save';
    if (Number(amount) > claim.limit) return setError(`Claim must be within ${money(claim.limit)}.`);
    run(
      () => api(`/campaigns/${item.id}/claim`, { method: 'PUT', body: { amount: Number(amount), attested, submit: doSubmit } }),
      doSubmit ? `Claim ${claim.code} submitted for review.` : 'Claim saved.',
    );
  }

  return (
    <div className="grid">
      <section className="panel">
        <div className="panelhead plain">
          <h2>Claim {claim.code}</h2>
          <Badge>{claim.paidAt ? 'Paid' : claim.status}</Badge>
        </div>
        <Kv k="Campaign" v={item.title} />
        <Kv k="Funding / quarter" v={`${item.code} · ${quarterLabel(item.quarter)}`} />
        <Kv k="Approved funding" v={money(item.amount)} />
        <Kv k="Actual eligible spend" v={money(c.actualSpend)} />
        <Kv k="Maximum claim" v={money(claim.limit)} />
        {claim.amount !== null && <Kv k="Claimed" v={money(claim.amount)} />}
        <Kv k="Payment" v={claim.paidAt ? `${claim.paymentRef} · ${dateLabel(claim.paidAt)}` : 'Not paid'} />
        <hr className="rule" />
        <Check done={c.assetsApproved}>Current campaign assets approved</Check>
        <Check done={c.resultsReady}>Mandatory performance recorded</Check>
        <Check done={c.evidenceComplete}>Supporting evidence attached</Check>
        {claim.note && <Note>Reviewer feedback: {claim.note}</Note>}
      </section>

      <div>
        <section className="panel">
          {isPartner && (
            <form onSubmit={submit}>
              <fieldset disabled={locked || busy}>
                <div className="field">
                  <label htmlFor="claim-amount">Claim amount (£)</label>
                  <input id="claim-amount" type="number" min="0.01" step="0.01" max={claim.limit} required value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <label className="check">
                  <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />I confirm the costs, approved assets and evidence
                  accurately represent this campaign.
                </label>
                <ErrorText>{error}</ErrorText>
                {!locked && (
                  <div className="actions">
                    <button className="btn" value="submit">
                      Submit claim for review
                    </button>
                    <button className="btn secondary" value="save">
                      Save
                    </button>
                  </div>
                )}
              </fieldset>
              {locked && (
                <p className="muted">
                  {claim.status === 'Submitted'
                    ? 'Your claim is awaiting review.'
                    : claim.status === 'Approved'
                      ? `Claim approved for ${money(claim.amount)}.${claim.paidAt ? ' Payment recorded.' : ' Payment follows the finance handoff.'}`
                      : 'Claim rejected. The decision is kept in the history.'}
                </p>
              )}
            </form>
          )}

          {!isPartner && claim.status === 'Submitted' && (
            <>
              <h3>Review claim</h3>
              <p className="muted small">Verify costs, delivery and the submitted evidence pack before deciding.</p>
              <DecisionForm
                options={['Approved', 'Changes requested', 'Rejected']}
                busy={busy}
                error={error}
                onDecide={(decision, note) => run(() => api(`/campaigns/${item.id}/claim/decision`, { body: { decision, note } }), `Claim: ${decision}.`)}
              />
            </>
          )}

          {!isPartner && claim.status === 'Approved' && !claim.paidAt && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api(`/campaigns/${item.id}/claim/payment`, { body: { reference: payRef, date: payDate } }), 'Payment recorded.');
              }}
            >
              <h3>Record payment</h3>
              <p className="muted small">Records the finance system’s payment reference. No money is moved by this portal.</p>
              <div className="fields">
                <div className="field">
                  <label htmlFor="pay-ref">External payment reference</label>
                  <input id="pay-ref" required maxLength={60} value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="pay-date">Payment date</label>
                  <input id="pay-date" type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
              </div>
              <Kv k="Amount" v={money(claim.amount)} />
              <ErrorText>{error}</ErrorText>
              <button className="btn spaced" disabled={busy}>
                Record payment →
              </button>
            </form>
          )}
          {!isPartner && claim.status !== 'Submitted' && !(claim.status === 'Approved' && !claim.paidAt) && (
            <p className="muted">Only a submitted claim can be reviewed.</p>
          )}
          <hr className="rule" />
          <button className="btn secondary" onClick={onBack}>
            Review performance & evidence
          </button>
        </section>
        <History entries={history} title="Claim history" />
      </div>
    </div>
  );
}
