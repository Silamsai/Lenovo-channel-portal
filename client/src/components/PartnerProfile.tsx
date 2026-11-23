import { apiGet } from '@/lib/api';
import { changePassword, saveProfile } from '@/lib/actions';
import { money } from '@/lib/format';
import type { Partner, User } from '@/lib/types';
import { Badge, Crumbs, Kv, PageHead } from './ui';
import { PasswordCard, ProfileCard } from './ProfileCards';

/**
 * Partner profile: the partner's own (/profile, with password change) or any partner for reviewers (/partners/:id).
 * Details are read-only until the pencil icon is clicked.
 */
export async function PartnerProfile({ user, idKey }: { user: User; idKey: string }) {
  const p = await apiGet<Partner>(`/partners/${idKey}`);
  const isOwn = idKey === 'me';
  return (
    <>
      <Crumbs items={user.role === 'REVIEWER' ? [['Partner network', '/partners'], p.name] : ['Our profile']} />
      <PageHead role={user.role} title={p.name} sub={`Business partner profile · ${p.focus}`} action={<Badge>{p.status}</Badge>} />
      <div className="grid">
        <ProfileCard action={saveProfile.bind(null, idKey)} values={{ name: p.name, contact: p.contact, email: p.email, focus: p.focus, goal: p.goal }} />
        <div>
          <section className="panel">
            <h2>Partner access & segment</h2>
            <Kv k="Partner ID" v={p.code} />
            <Kv k="Segment" v={p.segment} />
            <Kv k="Programme owner" v={p.owner} />
            <Kv k="Annual MDF budget" v={money(p.annualBudget)} />
            <Kv k="Reward points" v={p.points.toLocaleString('en-GB')} />
          </section>
          {isOwn && (
            <>
              <section className="panel">
                <h2>Your account</h2>
                <Kv k="Name" v={user.name} />
                <Kv k="Sign-in email" v={user.email} />
              </section>
              <PasswordCard action={changePassword} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
