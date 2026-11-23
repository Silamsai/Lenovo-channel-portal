import type { FormState } from '@/lib/actions';
import type { Role } from '@/lib/types';
import { ActionForm, Submit } from '@/components/forms';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  partner: { id: number; name: string; code: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminPartner {
  id: number;
  code: string;
  name: string;
  contact: string;
  email: string;
  focus: string;
  segment: 'Strategic' | 'Growth';
  owner: string;
  status: 'Active' | 'Invited' | 'Suspended';
  annualBudget: number;
  goal: string;
  userCount?: number;
  fundingCount?: number;
}

export const ROLE_LABELS: Record<Role, string> = {
  PARTNER: 'Partner marketer',
  REVIEWER: 'Programme reviewer',
  ADMIN: 'Platform admin',
};

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Create or edit a user account. */
export function UserForm({ action, user, partners, isSelf }: { action: Action; user?: AdminUser; partners: AdminPartner[]; isSelf?: boolean }) {
  return (
    <ActionForm action={action}>
      <div className="fields">
        <div className="field">
          <label htmlFor="u-name">Full name</label>
          <input id="u-name" name="name" required maxLength={80} defaultValue={user?.name} />
        </div>
        <div className="field">
          <label htmlFor="u-email">Email (used to sign in)</label>
          <input id="u-email" name="email" type="email" required defaultValue={user?.email} />
        </div>
        <div className="field">
          <label htmlFor="u-role">Role</label>
          {isSelf ? (
            <>
              <input type="hidden" name="role" value="ADMIN" />
              <input id="u-role" value={ROLE_LABELS.ADMIN} readOnly />
            </>
          ) : (
            <select id="u-role" name="role" defaultValue={user?.role ?? 'PARTNER'}>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="field">
          <label htmlFor="u-partner">Partner organisation</label>
          <select id="u-partner" name="partnerId" defaultValue={user?.partner?.id ?? ''}>
            <option value="">None (programme team)</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          <small className="muted">Required for partner marketers; ignored for reviewers and admins.</small>
        </div>
      </div>
      {!user && (
        <div className="field">
          <label htmlFor="u-password">Temporary password (min. 8 characters)</label>
          <input id="u-password" name="password" type="text" required minLength={8} autoComplete="new-password" />
        </div>
      )}
      {user && !isSelf && (
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={user.active} />
          Account active (unticked = cannot sign in)
        </label>
      )}
      <p className="muted small">
        Partner marketers see only their own organisation’s data. Reviewers approve funding, assets, claims and partner requests. Platform admins manage users, organisations
        and settings.
      </p>
      <div className="actions">
        <Submit>{user ? 'Save changes' : 'Create user'} →</Submit>
        <a className="btn secondary" href="/admin/users">
          Cancel
        </a>
      </div>
    </ActionForm>
  );
}

const FOCUSES = ['ThinkPad workplace', 'ThinkSystem infrastructure', 'ThinkStation creators'];

/** Create or edit a partner organisation. */
export function PartnerForm({ action, partner }: { action: Action; partner?: AdminPartner }) {
  return (
    <ActionForm action={action}>
      <div className="fields">
        <div className="field">
          <label htmlFor="o-name">Organisation name</label>
          <input id="o-name" name="name" required maxLength={80} defaultValue={partner?.name} />
        </div>
        <div className="field">
          <label htmlFor="o-owner">Programme owner</label>
          <input id="o-owner" name="owner" required maxLength={80} defaultValue={partner?.owner} />
        </div>
        <div className="field">
          <label htmlFor="o-contact">Primary contact</label>
          <input id="o-contact" name="contact" required maxLength={80} defaultValue={partner?.contact} />
        </div>
        <div className="field">
          <label htmlFor="o-email">Contact email</label>
          <input id="o-email" name="email" type="email" required defaultValue={partner?.email} />
        </div>
        <div className="field">
          <label htmlFor="o-focus">Solution focus</label>
          <select id="o-focus" name="focus" defaultValue={partner?.focus ?? FOCUSES[0]}>
            {FOCUSES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="o-segment">Segment</label>
          <select id="o-segment" name="segment" defaultValue={partner?.segment ?? 'Growth'}>
            <option>Strategic</option>
            <option>Growth</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="o-status">Status</label>
          <select id="o-status" name="status" defaultValue={partner?.status ?? 'Invited'}>
            <option>Active</option>
            <option>Invited</option>
            <option>Suspended</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="o-budget">Annual MDF budget (£)</label>
          <input id="o-budget" name="annualBudget" type="number" min="0" step="100" placeholder={partner ? '' : 'Default from settings'} defaultValue={partner?.annualBudget} />
        </div>
      </div>
      <div className="actions">
        <Submit>{partner ? 'Save changes' : 'Create organisation'} →</Submit>
        <a className="btn secondary" href="/admin/users?tab=partners">
          Cancel
        </a>
      </div>
    </ActionForm>
  );
}
