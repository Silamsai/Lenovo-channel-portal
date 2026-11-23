'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Role } from '@/lib/types';
import { brand } from '@/lib/brand';

const brandName = brand.name;

const ROLE_LABELS: Record<Role, string> = {
  PARTNER: 'Partner marketer',
  REVIEWER: 'Programme reviewer',
  ADMIN: 'Platform admin',
};

/**
 * Role select plus partner organisation select. The organisation field only appears for
 * partner marketers; when no organisations exist yet it links to "Add organisation".
 */
export function RoleFields({
  defaultRole,
  defaultPartnerId,
  partners,
  lockedAdmin,
}: {
  defaultRole: Role;
  defaultPartnerId?: number | null;
  partners: { id: number; name: string; code: string }[];
  lockedAdmin?: boolean;
}) {
  const [role, setRole] = useState<Role>(defaultRole);

  return (
    <>
      <div className="field">
        <label htmlFor="u-role">Role</label>
        {lockedAdmin ? (
          <>
            <input type="hidden" name="role" value="ADMIN" />
            <input id="u-role" value={ROLE_LABELS.ADMIN} readOnly />
          </>
        ) : (
          <select id="u-role" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
      </div>

      {role === 'PARTNER' ? (
        <div className="field">
          <label htmlFor="u-partner">Partner organisation</label>
          {partners.length ? (
            <>
              <select id="u-partner" name="partnerId" required defaultValue={defaultPartnerId ?? ''}>
                <option value="" disabled>
                  Choose the partner organisation…
                </option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
              <small className="muted">The partner sees only this organisation’s data.</small>
            </>
          ) : (
            <div className="empty-hint">
              No partner organisations yet. A partner marketer must belong to one.
              <br />
              <Link href="/admin/partners/new">＋ Add organisation first →</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="field">
          <label>Organisation</label>
          <input value={`${brandName} programme team`} readOnly />
        </div>
      )}
    </>
  );
}
