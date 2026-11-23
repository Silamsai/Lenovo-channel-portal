import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAction } from '../api/hooks';
import { dateLabel } from '../api/format';
import { Badge, Crumbs, ErrorText, Loading, Metric, PageHead } from '../components/ui';

interface RewardsData {
  items: { id: number; name: string; cost: number }[];
  pointsPerActivity: number;
  balance: number;
  available: number;
  entries: { id: number; kind: string; points: number; reason: string; status: string; decisionNote: string | null; createdAt: string }[];
}

export function Rewards() {
  const q = useQuery({ queryKey: ['rewards'], queryFn: () => api<RewardsData>('/rewards') });
  const earn = useAction();
  const redeem = useAction();
  const [activity, setActivity] = useState('');
  const [evidence, setEvidence] = useState('');
  if (q.isLoading) return <Loading />;
  const d = q.data!;
  const pending = d.entries.filter((e) => e.status === 'Pending').length;

  async function submitEarn(e: FormEvent) {
    e.preventDefault();
    const ok = await earn.run(() => api('/rewards/earn', { body: { activity, evidence } }), 'Activity submitted for points approval.');
    if (ok) {
      setActivity('');
      setEvidence('');
    }
  }

  return (
    <>
      <Crumbs items={['Rewards']} />
      <PageHead title="Partner rewards" sub="Earn points for approved activity and request programme support." />
      <div className="metrics">
        <Metric label="Points balance" value={d.balance.toLocaleString('en-GB')} note="Approved points" />
        <Metric label="Available to redeem" value={d.available.toLocaleString('en-GB')} note="After pending redemptions" />
        <Metric label="Pending requests" value={pending} note="Awaiting programme approval" />
        <Metric label="Reward rule" value={`${d.pointsPerActivity} pts`} note="Per approved activity or claim" />
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
              <button
                className="btn secondary"
                disabled={redeem.busy || d.available < r.cost}
                onClick={() => redeem.run(() => api(`/rewards/${r.id}/redeem`, { method: 'POST' }), `Redemption requested: ${r.name}.`)}
              >
                Redeem
              </button>
            </div>
          ))}
          <div className="pad">
            <ErrorText>{redeem.error}</ErrorText>
          </div>
        </section>
        <form className="panel" onSubmit={submitEarn}>
          <h2>Earn points</h2>
          <p className="muted small">Submit completed enablement or programme activity. The programme team approves points.</p>
          <div className="field">
            <label htmlFor="r-activity">Activity</label>
            <input id="r-activity" required maxLength={120} value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="e.g. Sales team completed campaign essentials" />
          </div>
          <div className="field">
            <label htmlFor="r-evidence">Evidence</label>
            <textarea id="r-evidence" required maxLength={500} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          </div>
          <ErrorText>{earn.error}</ErrorText>
          <button className="btn" disabled={earn.busy}>
            Submit for points →
          </button>
        </form>
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
