import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { useFundingList } from '../api/hooks';
import { dateLabel, money, quarterLabel } from '../api/format';
import { Badge, Crumbs, Loading, Metric, Note, PageHead, QuarterSelect } from '../components/ui';

const FUNDING_STATUSES = ['Draft', 'Submitted', 'Approved', 'Changes requested', 'Rejected'];
const CLAIM_STATUSES = ['Draft', 'Submitted', 'Approved', 'Changes requested', 'Rejected'];

export function FundingList({ tab }: { tab: 'funding' | 'claims' }) {
  const user = useUser();
  const isPartner = user.role === 'PARTNER';
  const [quarter, setQuarter] = useState('all');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const list = useFundingList(quarter);

  if (list.isLoading) return <Loading />;
  const all = list.data?.items ?? [];
  const budget = list.data?.budget;
  const match = (text: string) => text.toLowerCase().includes(q.trim().toLowerCase());

  const fundingRows = all.filter((f) => match(`${f.code} ${f.title} ${f.partner.name} ${f.type}`) && (!status || f.status === status));
  const claimRows = all
    .filter((f) => f.campaign?.claim)
    .filter((f) => match(`${f.campaign!.claim!.code} ${f.code} ${f.title} ${f.partner.name}`) && (!status || f.campaign!.claim!.status === status));

  return (
    <>
      <Crumbs items={['Funding & claims']} />
      <PageHead
        title="Funding & claims"
        sub={tab === 'funding' ? 'Plan quarterly investment and follow every request through to reimbursement.' : 'Track claim readiness, decisions and payment.'}
        action={
          isPartner && (
            <Link className="btn" to="/funding/new">
              Request funding →
            </Link>
          )
        }
      />
      <div className="steps">
        <span className={tab === 'funding' ? 'on' : ''}>01 Request funding</span>
        <span>02 Funding approval</span>
        <span>03 Run campaign</span>
        <span>04 Performance & POE</span>
        <span className={tab === 'claims' ? 'on' : ''}>05 Claim</span>
      </div>
      <div className="tabs">
        <Link to="/funding" className={tab === 'funding' ? 'on' : ''} onClick={() => setStatus('')}>
          Funding requests
        </Link>
        <Link to="/claims" className={tab === 'claims' ? 'on' : ''} onClick={() => setStatus('')}>
          Claims & POE
        </Link>
      </div>

      {budget && tab === 'funding' && (
        <div className="metrics">
          <Metric label="Programme budget" value={money(budget.budget)} note="Annual allocation" />
          <Metric label="Funding approved" value={money(budget.approved)} note="Reserved for approved activity" />
          <Metric label="In review" value={money(budget.pending)} note="Submitted, awaiting decision" />
          <Metric label="Available to request" value={money(budget.available)} note="Subject to programme review" />
        </div>
      )}

      <div className="filters">
        <input aria-label="Search" placeholder="Search by reference, activity or partner" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {(tab === 'funding' ? FUNDING_STATUSES : CLAIM_STATUSES).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <QuarterSelect value={quarter} onChange={setQuarter} />
      </div>

      {tab === 'funding' ? (
        <section className="panel flush">
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Request / activity</th>
                  {!isPartner && <th>Partner</th>}
                  <th>Quarter</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fundingRows.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.code}
                      <small>{f.title}</small>
                    </td>
                    {!isPartner && <td>{f.partner.name}</td>}
                    <td>
                      {quarterLabel(f.quarter)}
                      <small>{dateLabel(f.date)}</small>
                    </td>
                    <td>{money(f.amount)}</td>
                    <td>
                      <Badge>{f.status}</Badge>
                    </td>
                    <td>
                      <Link to={f.campaign ? `/campaigns/${f.id}` : `/funding/${f.id}`}>{f.campaign ? 'Open campaign →' : 'View →'}</Link>
                    </td>
                  </tr>
                ))}
                {!fundingRows.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No matching requests. Change the filters or create a request.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          <section className="panel flush">
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Claim / activity</th>
                    {!isPartner && <th>Partner</th>}
                    <th>Funding</th>
                    <th>Claimed</th>
                    <th>Evidence</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {claimRows.map((f) => {
                    const c = f.campaign!;
                    const claim = c.claim!;
                    const evidenceCount = Object.values(c.evidence).filter((x) => x.length).length;
                    return (
                      <tr key={f.id}>
                        <td>
                          {claim.code}
                          <small>{f.title}</small>
                        </td>
                        {!isPartner && <td>{f.partner.name}</td>}
                        <td>
                          {f.code}
                          <small>{quarterLabel(f.quarter)}</small>
                        </td>
                        <td>{claim.amount !== null ? money(claim.amount) : '—'}</td>
                        <td>{evidenceCount} / 3 categories</td>
                        <td>
                          <Badge>{claim.paidAt ? 'Paid' : claim.status}</Badge>
                        </td>
                        <td>
                          <Link to={`/campaigns/${f.id}/5`}>Open →</Link>
                        </td>
                      </tr>
                    );
                  })}
                  {!claimRows.length && (
                    <tr>
                      <td colSpan={7} className="muted">
                        No claims yet. A claim is created when a funded campaign starts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <Note>Claim approval and payment are separate steps. Payment is recorded after the finance handoff.</Note>
        </>
      )}
      <p className="muted small">Programme rules: approval precedes execution; maximum contribution is 50% of eligible cost and £15,000 per request.</p>
    </>
  );
}
