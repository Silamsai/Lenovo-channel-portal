import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { dateLabel, money, quarterLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { Budget, Funding, ProgrammeSettings } from '@/lib/types';
import { Badge, Crumbs, FilterBar, Metric, Note, PageHead } from '@/components/ui';
import { AutoSubmitSelect } from '@/components/forms';

const STATUSES = ['Draft', 'Submitted', 'Approved', 'Changes requested', 'Rejected'];

export type ListParams = { quarter?: string; q?: string; status?: string };

/** Funding requests and claims: two tabs, each its own page (/funding and /claims). */
export async function FundingList({ tab, params }: { tab: 'funding' | 'claims'; params: ListParams }) {
  const user = await requireUser('PARTNER', 'REVIEWER');
  const isPartner = user.role === 'PARTNER';
  const quarter = params.quarter ?? 'all';
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';
  const [list, rules] = await Promise.all([
    apiGet<{ items: Funding[]; budget: Budget | null }>(`/funding?quarter=${encodeURIComponent(quarter)}`),
    apiGet<ProgrammeSettings>('/settings'),
  ]);
  const match = (text: string) => text.toLowerCase().includes(q);
  const fundingRows = list.items.filter((f) => match(`${f.code} ${f.title} ${f.partner.name} ${f.type}`) && (!status || f.status === status));
  const claimRows = list.items
    .filter((f) => f.campaign?.claim)
    .filter((f) => match(`${f.campaign!.claim!.code} ${f.code} ${f.title} ${f.partner.name}`) && (!status || f.campaign!.claim!.status === status));
  const base = tab === 'funding' ? '/funding' : '/claims';

  return (
    <>
      <Crumbs items={['Funding & claims']} />
      <PageHead
        role={user.role}
        title="Funding & claims"
        sub={tab === 'funding' ? 'Plan quarterly investment and follow every request through to reimbursement.' : 'Track claim readiness, decisions and payment.'}
        action={
          isPartner && (
            <Link className="btn" href="/funding/new">
              Request funding →
            </Link>
          )
        }
      />
      <div className="tabs">
        <Link href="/funding" className={tab === 'funding' ? 'on' : ''}>
          Funding requests
        </Link>
        <Link href="/claims" className={tab === 'claims' ? 'on' : ''}>
          Claims & POE
        </Link>
      </div>

      {list.budget && tab === 'funding' && (
        <div className="metrics">
          <Metric label="Programme budget" value={money(list.budget.budget)} note="Annual allocation" />
          <Metric label="Funding approved" value={money(list.budget.approved)} note="Reserved for approved activity" />
          <Metric label="In review" value={money(list.budget.pending)} note="Submitted, awaiting decision" />
          <Metric label="Available to request" value={money(list.budget.available)} note="Subject to programme review" />
        </div>
      )}

      <FilterBar action={base} quarter={quarter}>
        <input name="q" aria-label="Search" placeholder="Search by reference, activity or partner" defaultValue={params.q ?? ''} />
        <AutoSubmitSelect name="status" label="Status" value={status} options={[['', 'All statuses'], ...STATUSES.map((s) => [s, s] as [string, string])]} />
      </FilterBar>

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
                      <Link href={f.campaign ? `/campaigns/${f.id}` : `/funding/${f.id}`}>{f.campaign ? 'Open campaign →' : 'View →'}</Link>
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
                        <td>{Object.values(c.evidence).filter((x) => x.length).length} / 3 categories</td>
                        <td>
                          <Badge>{claim.paidAt ? 'Paid' : claim.status}</Badge>
                        </td>
                        <td>
                          <Link href={`/campaigns/${f.id}/5`}>Open →</Link>
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
      <p className="muted small">
        Programme rules: approval precedes execution; maximum contribution is {rules.contributionPercent}% of eligible cost and {money(rules.maxRequestGbp)} per request.
      </p>
    </>
  );
}
