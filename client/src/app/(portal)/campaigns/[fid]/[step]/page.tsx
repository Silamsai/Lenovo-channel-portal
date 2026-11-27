import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApiError, apiGet } from '@/lib/api';
import {
  decideAssets,
  decideClaim,
  decideFunding,
  recordPayment,
  removeAsset,
  removeEvidence,
  saveClaim,
  savePerformance,
  startCampaign,
  submitAssets,
  uploadAssets,
  uploadEvidence,
} from '@/lib/actions';
import { EVIDENCE, dateLabel, money, quarterLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { stepAllowed } from '@/lib/status';
import type { Funding, HistoryEntry, ProgrammeSettings, User } from '@/lib/types';
import { Badge, Check, Crumbs, FileRows, History, Kv, Note, PageHead } from '@/components/ui';
import { ActionForm, Submit, UploadField } from '@/components/forms';
import { DecisionForm } from '@/components/DecisionForm';

export const metadata = { title: 'Campaign' };

const LABELS = ['Request funding', 'Funding approval', 'Run campaign', 'Performance & POE', 'Claim'];
const LOCKED = ['Submitted', 'Approved', 'Rejected'];
type Histories = { funding: HistoryEntry[]; assets: HistoryEntry[]; claim: HistoryEntry[] };

/** The 5-step campaign journey. Each step is its own page: /campaigns/:fid/1 … /5. */
export default async function CampaignStepPage({ params }: { params: Promise<{ fid: string; step: string }> }) {
  const user = await requireUser('PARTNER', 'REVIEWER');
  const p = await params;
  const fid = Number(p.fid);
  const step = Number(p.step);
  if (!Number.isInteger(fid) || !(step >= 1 && step <= 5)) notFound();
  // All data for the step in parallel. /campaigns/:fid answers 409 until the campaign is started.
  const [funding, detail, rules] = await Promise.all([
    apiGet<{ item: Funding; history: HistoryEntry[] }>(`/funding/${fid}`),
    step === 3 || step === 5
      ? apiGet<{ item: Funding; history: Histories }>(`/campaigns/${fid}`).catch((e) => {
          if (e instanceof ApiError && e.status === 409) return null;
          throw e;
        })
      : null,
    step === 4 ? apiGet<ProgrammeSettings>('/settings') : null,
  ]);
  const item = funding.item;
  const histories: Histories | null = detail?.history ?? null;
  if (!stepAllowed(item, step)) redirect(`/campaigns/${fid}`);

  return (
    <>
      <Crumbs items={[[user.role === 'PARTNER' ? 'My campaigns' : 'Funding & claims', user.role === 'PARTNER' ? '/campaigns' : '/funding'], item.title]} />
      <PageHead
        role={user.role}
        title={item.title}
        sub={`${item.code} · ${quarterLabel(item.quarter)} · ${item.type} · ${item.partner.name}`}
        action={
          <Link className="btn secondary" href={user.role === 'PARTNER' ? '/campaigns' : '/funding'}>
            All campaigns
          </Link>
        }
      />
      <nav className="journey-rail" aria-label="Campaign steps">
        {LABELS.map((label, i) =>
          stepAllowed(item, i + 1) ? (
            <Link key={label} href={`/campaigns/${fid}/${i + 1}`} className={step === i + 1 ? 'current' : ''} aria-current={step === i + 1 ? 'step' : undefined}>
              <span>0{i + 1}</span>
              {label}
            </Link>
          ) : (
            <span key={label} className="disabled">
              <span>0{i + 1}</span>
              {label}
            </span>
          ),
        )}
      </nav>
      {step === 1 && <StepRequest item={item} />}
      {step === 2 && <StepApproval item={item} user={user} history={funding.history} />}
      {step === 3 && <StepAssets item={item} user={user} history={histories?.assets ?? []} />}
      {step === 4 && rules && <StepPerformance item={item} user={user} rules={rules} />}
      {step === 5 && <StepClaim item={item} user={user} history={histories?.claim ?? []} />}
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
      <p className="muted spaced">{item.objective}</p>
      <Link className="btn secondary" href={`/funding/${item.id}`}>
        Open funding request →
      </Link>
    </section>
  );
}

// ---------- 02 Approval ----------

function StepApproval({ item, user, history }: { item: Funding; user: User; history: HistoryEntry[] }) {
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
            <Link className="btn" href={`/campaigns/${item.id}/3`}>
              Continue to run campaign →
            </Link>
          ) : (
            <Link className="btn secondary" href={`/funding/${item.id}`}>
              View funding request
            </Link>
          )}
        </div>
        {user.role === 'REVIEWER' && item.status === 'Submitted' && (
          <>
            <hr className="rule" />
            <DecisionForm action={decideFunding.bind(null, item.id)} options={['Approved', 'Changes requested', 'Rejected']} />
          </>
        )}
        <p className="muted small spaced">Funding approval is required before running the campaign.</p>
      </section>
      <History entries={history} />
    </div>
  );
}

// ---------- 03 Run campaign: assets ----------

function StepAssets({ item, user, history }: { item: Funding; user: User; history: HistoryEntry[] }) {
  const isPartner = user.role === 'PARTNER';
  const c = item.campaign;
  if (!c) {
    return (
      <section className="panel">
        <h2>Start your funded campaign</h2>
        <p>
          Funding {item.code} is approved for {money(item.amount)}. Starting the campaign creates its claim record and opens asset approval, performance and evidence.
        </p>
        {isPartner ? (
          <ActionForm action={startCampaign.bind(null, item.id)}>
            <Submit>Start funded campaign →</Submit>
          </ActionForm>
        ) : (
          <p className="muted">The partner has not started this campaign yet.</p>
        )}
      </section>
    );
  }
  const claimLocked = LOCKED.includes(c.claim?.status ?? '');
  const canEdit = isPartner && c.assetStatus !== 'Submitted' && !claimLocked;
  const base = `/download/campaigns/${item.id}/files`;

  return (
    <>
      <Note>Upload your final campaign creative and request approval. The approved version carries forward to performance, POE and the claim.</Note>
      <div className="grid">
        <section className="panel">
          <div className="panelhead plain">
            <h2>Campaign assets</h2>
            <Badge>{c.assetStatus}</Badge>
          </div>
          <p className="muted small">Version {c.assetVersion} · {c.assets.length} file(s). Changing approved files starts a new version that needs approval again.</p>
          {c.assetNote && <Note>{c.assetNote}</Note>}
          <FileRows
            files={c.assets}
            downloadBase={base}
            remove={
              canEdit
                ? (f) => (
                    <ActionForm action={removeAsset.bind(null, item.id, f.id)} inline>
                      <Submit small danger>
                        Remove
                      </Submit>
                    </ActionForm>
                  )
                : undefined
            }
          />
          <div className="actions spaced">
            {canEdit && (
              <ActionForm action={uploadAssets.bind(null, item.id)} inline>
                <UploadField label="Add campaign assets" />
              </ActionForm>
            )}
            {isPartner && ['Draft', 'Changes requested'].includes(c.assetStatus) && !claimLocked && c.assets.length > 0 && (
              <ActionForm action={submitAssets.bind(null, item.id)} inline>
                <Submit>Submit for approval</Submit>
              </ActionForm>
            )}
            {c.assetsApproved && (
              <Link className="btn" href={`/campaigns/${item.id}/4`}>
                Continue to performance & POE →
              </Link>
            )}
          </div>
          {!isPartner && c.assetStatus === 'Submitted' && (
            <>
              <hr className="rule" />
              <h3>Review assets</h3>
              <DecisionForm action={decideAssets.bind(null, item.id)} options={['Approved', 'Changes requested']} />
            </>
          )}
        </section>
        <History entries={history} title="Version & decision history" />
      </div>
    </>
  );
}

// ---------- 04 Performance & POE ----------

function StepPerformance({ item, user, rules }: { item: Funding; user: User; rules: ProgrammeSettings }) {
  const isPartner = user.role === 'PARTNER';
  const c = item.campaign!;
  const locked = !isPartner || LOCKED.includes(c.claim?.status ?? '');
  const fields = c.metricFields.map(([k]) => k);

  return (
    <>
      {isPartner ? (
        <Note>Results are required to complete the campaign and submit its claim. Counts are unique people or actions. Enter 0 for a measured zero.</Note>
      ) : !c.resultsReady ? (
        <Note>The partner has not submitted campaign performance results yet. Once recorded by {item.partner.name}, the metrics and POE will appear here for audit.</Note>
      ) : (
        <Note>Campaign performance recorded by {item.partner.name}. Review the reported metrics and supporting proof of execution below.</Note>
      )}
      <div className="grid">
        <section className="panel">
          <h2>Campaign performance</h2>
          {!isPartner ? (
            !c.resultsReady ? (
              <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--line)', padding: '24px 20px', borderRadius: 'var(--radius)', marginTop: '8px' }}>
                <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>
                  Awaiting partner submission
                </p>
                <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
                  {item.partner.name} has not recorded performance metrics for this campaign yet. When the partner completes the campaign execution and enters their registrations, attendees, and eligible spend, the figures will be displayed here for audit.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', margin: '12px 0 16px' }}>
                  {c.metricFields.map(([k, label]) => (
                    <div key={k} style={{ background: 'var(--surface-alt)', padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</span>
                      <strong style={{ fontSize: '20px', color: 'var(--ink)', marginTop: '4px', display: 'block' }}>{c.metrics[k] ?? 0}</strong>
                    </div>
                  ))}
                  <div style={{ background: 'var(--surface-alt)', padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Actual eligible spend</span>
                    <strong style={{ fontSize: '20px', color: 'var(--ink)', marginTop: '4px', display: 'block' }}>{money(c.actualSpend)}</strong>
                  </div>
                </div>
                <p className="muted small" style={{ margin: 0 }}>Reported by {item.partner.name} on campaign completion.</p>
              </div>
            )
          ) : (
            <ActionForm action={savePerformance.bind(null, item.id, fields)}>
              <fieldset disabled={locked}>
                <div className="fields">
                  {c.metricFields.map(([k, label]) => (
                    <div className="field" key={k}>
                      <label htmlFor={`m-${k}`}>{label} *</label>
                      <input id={`m-${k}`} name={`m_${k}`} type="number" min="0" step="1" required defaultValue={c.metrics[k] ?? ''} />
                    </div>
                  ))}
                  <div className="field">
                    <label htmlFor="m-spend">Actual eligible spend (£) *</label>
                    <input id="m-spend" name="spend" type="number" min="0" step="0.01" required defaultValue={c.actualSpend ?? ''} />
                  </div>
                </div>
                {!locked && (
                  <div className="actions">
                    <Submit value="save">Save performance</Submit>
                    <Submit value="complete" secondary>
                      Complete campaign
                    </Submit>
                  </div>
                )}
              </fieldset>
            </ActionForm>
          )}
          {locked && isPartner && <p className="muted small spaced">Performance is locked with the submitted claim.</p>}
        </section>
        <section className="panel">
          <h2>Funding & reporting</h2>
          <Kv k="Approved request" v={item.code} />
          <Kv k="Quarter" v={quarterLabel(item.quarter)} />
          <Kv k="Execution date" v={dateLabel(item.date)} />
          <Kv k="Approved allocation" v={money(item.amount)} />
          <Kv k="Performance" v={<Badge>{c.resultsReady ? 'Recorded' : 'Missing'}</Badge>} />
          <Kv k="Campaign" v={c.completedAt ? 'Completed' : 'In progress'} />
          <p className="muted small spaced">Contribution: {rules.contributionPercent}% of actual eligible spend, capped at the approved allocation.</p>
        </section>
      </div>

      <section className="panel">
        <h2>Proof of execution</h2>
        <p className="muted small">
          {isPartner
            ? 'Approved creative carries forward from step 03. Attach the remaining evidence. Maximum 25 MB per file and 100 MB per campaign.'
            : 'Approved creative carries forward from step 03. Supporting evidence and supplier invoices uploaded by the partner will appear here for audit.'}
        </p>
        <Kv k="Approved campaign assets" v={`${c.assets.length} file(s) · v${c.assetVersion}`} />
        {EVIDENCE.map(({ kind, label }) => (
          <div className="poe-category" key={kind}>
            <div className="panelhead plain">
              <h3>{label}</h3>
              <Badge>{c.evidence[kind].length ? 'Attached' : isPartner ? 'Required' : 'Awaiting upload'}</Badge>
            </div>
            <FileRows
              files={c.evidence[kind]}
              downloadBase={`/download/campaigns/${item.id}/files`}
              remove={
                !locked
                  ? (f) => (
                      <ActionForm action={removeEvidence.bind(null, item.id, f.id)} inline>
                        <Submit small danger>
                          Remove
                        </Submit>
                      </ActionForm>
                    )
                  : undefined
              }
            />
            {!locked && (
              <ActionForm action={uploadEvidence.bind(null, item.id, kind)}>
                <UploadField label={`Add ${label.toLowerCase()}`} />
              </ActionForm>
            )}
          </div>
        ))}
        <div className="actions spaced">
          <a className="btn secondary" href={`/download/campaigns/${item.id}/export?type=pptx`}>
            Download PowerPoint
          </a>
          <a className="btn secondary" href={`/download/campaigns/${item.id}/export?type=zip`}>
            Download POE ZIP
          </a>
          <Link className="btn" href={`/campaigns/${item.id}/5`}>
            Continue to claim →
          </Link>
        </div>
      </section>
    </>
  );
}

// ---------- 05 Claim ----------

function StepClaim({ item, user, history }: { item: Funding; user: User; history: HistoryEntry[] }) {
  const isPartner = user.role === 'PARTNER';
  const c = item.campaign!;
  const claim = c.claim!;
  const locked = LOCKED.includes(claim.status);
  const today = new Date().toISOString().slice(0, 10);

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
          {isPartner &&
            (locked ? (
              <p className="muted">
                {claim.status === 'Submitted'
                  ? 'Your claim is awaiting review.'
                  : claim.status === 'Approved'
                    ? `Claim approved for ${money(claim.amount)}.${claim.paidAt ? ' Payment recorded.' : ' Payment follows the finance handoff.'}`
                    : 'Claim rejected. The decision is kept in the history.'}
              </p>
            ) : (
              <ActionForm action={saveClaim.bind(null, item.id)}>
                <div className="field">
                  <label htmlFor="claim-amount">Claim amount (£)</label>
                  <input id="claim-amount" name="amount" type="number" min="0.01" step="0.01" max={claim.limit} required defaultValue={claim.amount ?? claim.limit} />
                </div>
                <label className="check">
                  <input type="checkbox" name="attested" defaultChecked={claim.attested} />I confirm the costs, approved assets and evidence accurately represent this campaign.
                </label>
                <div className="actions">
                  <Submit value="submit">Submit claim for review</Submit>
                  <Submit value="save" secondary>
                    Save
                  </Submit>
                </div>
              </ActionForm>
            ))}

          {!isPartner && claim.status === 'Submitted' && (
            <>
              <h3>Review claim</h3>
              <p className="muted small">Verify costs, delivery and the submitted evidence pack before deciding.</p>
              <DecisionForm action={decideClaim.bind(null, item.id)} options={['Approved', 'Changes requested', 'Rejected']} />
            </>
          )}

          {!isPartner && claim.status === 'Approved' && !claim.paidAt && (
            <>
              <h3>Record payment</h3>
              <p className="muted small">Records the finance system’s payment reference. No money is moved by this portal.</p>
              <ActionForm action={recordPayment.bind(null, item.id)}>
                <div className="fields">
                  <div className="field">
                    <label htmlFor="pay-ref">External payment reference</label>
                    <input id="pay-ref" name="reference" required maxLength={60} />
                  </div>
                  <div className="field">
                    <label htmlFor="pay-date">Payment date</label>
                    <input id="pay-date" name="date" type="date" required defaultValue={today} />
                  </div>
                </div>
                <Kv k="Amount" v={money(claim.amount)} />
                <div className="spaced">
                  <Submit>Record payment →</Submit>
                </div>
              </ActionForm>
            </>
          )}
          {!isPartner && claim.status !== 'Submitted' && !(claim.status === 'Approved' && !claim.paidAt) && <p className="muted">Only a submitted claim can be reviewed.</p>}
          <hr className="rule" />
          <Link className="btn secondary" href={`/campaigns/${item.id}/4`}>
            Review performance & evidence
          </Link>
        </section>
        <History entries={history} title="Claim history" />
      </div>
    </div>
  );
}
