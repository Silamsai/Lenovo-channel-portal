import { apiGet } from '@/lib/api';
import { earnPoints, redeemReward } from '@/lib/actions';
import { dateLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { Badge, Crumbs, Metric, PageHead } from '@/components/ui';
import { ActionForm, Submit } from '@/components/forms';

export const metadata = { title: 'Rewards' };

interface RewardsData {
  items: { id: number; name: string; cost: number }[];
  pointsPerActivity: number;
  balance: number;
  available: number;
  entries: { id: number; kind: string; points: number; reason: string; status: string; decisionNote: string | null; createdAt: string }[];
}

export default async function RewardsPage() {
  const user = await requireUser('PARTNER');
  const d = await apiGet<RewardsData>('/rewards');
  const pending = d.entries.filter((e) => e.status === 'Pending').length;

  return (
    <>
      <Crumbs items={['Rewards']} />
      <PageHead role={user.role} title="Partner rewards" sub="Earn points for approved activity and request programme support." />
      <div className="metrics">
        <Metric label="Points balance" value={d.balance.toLocaleString('en-GB')} note="Approved points" />
        <Metric label="Available to redeem" value={d.available.toLocaleString('en-GB')} note="After pending redemptions" />
        <Metric label="Pending requests" value={pending} note="Awaiting programme approval" />
        <Metric label="Reward rule" value={`${d.pointsPerActivity} pts`} note="Per approved activity" />
      </div>
      <div className="grid">
        <section className="panel flush">
          <div className="panelhead">
            <h2>Redeem points</h2>
          </div>
          {d.items.map((r) => (
            <div className="task" key={r.id}>
              <span className="num">☆</span>
              <div>
                <strong>{r.name}</strong>
                <p>{r.cost.toLocaleString('en-GB')} points</p>
              </div>
              {d.available >= r.cost ? (
                <ActionForm action={redeemReward.bind(null, r.id)} inline>
                  <Submit secondary>Redeem</Submit>
                </ActionForm>
              ) : (
                <span className="muted small">Not enough points</span>
              )}
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Earn points</h2>
          <p className="muted small">Submit completed enablement or programme activity. The programme team approves points.</p>
          <ActionForm action={earnPoints}>
            <div className="field">
              <label htmlFor="r-activity">Activity</label>
              <input id="r-activity" name="activity" required maxLength={120} placeholder="e.g. Sales team completed campaign essentials" />
            </div>
            <div className="field">
              <label htmlFor="r-evidence">Evidence</label>
              <textarea id="r-evidence" name="evidence" required maxLength={500} />
            </div>
            <Submit>Submit for points →</Submit>
          </ActionForm>
        </section>
      </div>
      <section className="panel flush">
        <div className="panelhead">
          <h2>Activity history</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Date</th>
                <th>Points</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.reason}
                    {e.decisionNote && <small>{e.decisionNote}</small>}
                  </td>
                  <td>{dateLabel(e.createdAt)}</td>
                  <td>{e.points > 0 ? `+${e.points}` : e.points}</td>
                  <td>
                    <Badge>{e.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
