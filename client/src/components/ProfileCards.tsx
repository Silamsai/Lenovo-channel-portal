'use client';

import { useState } from 'react';
import { LuPencil, LuX } from 'react-icons/lu';
import type { FormState } from '@/lib/actions';
import { ActionForm, Submit } from './forms';
import { PasswordInput } from './PasswordInput';

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const FOCUSES = ['ThinkPad workplace', 'ThinkSystem infrastructure', 'ThinkStation creators'];

/** Pencil / close button shown in a panel's top-right corner. */
function EditToggle({ editing, onClick, label }: { editing: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className="icon-button" onClick={onClick} aria-label={editing ? `Cancel editing ${label}` : `Edit ${label}`} title={editing ? 'Cancel' : 'Edit'}>
      {editing ? <LuX aria-hidden /> : <LuPencil aria-hidden />}
    </button>
  );
}

export interface ProfileValues {
  name: string;
  contact: string;
  email: string;
  focus: string;
  goal: string;
}

/** Organisation & contacts: read-only until the pencil icon is clicked. */
export function ProfileCard({ action, values }: { action: Action; values: ProfileValues }) {
  const [editing, setEditing] = useState(false);
  // Remount the form on cancel so fields go back to the saved values.
  const [formKey, setFormKey] = useState(0);
  const cancel = () => {
    setEditing(false);
    setFormKey((k) => k + 1);
  };

  return (
    <section className={`panel ${editing ? 'is-editing' : ''}`}>
      <div className="panelhead plain">
        <h2>Organisation & contacts</h2>
        <EditToggle editing={editing} onClick={editing ? cancel : () => setEditing(true)} label="organisation and contacts" />
      </div>
      <ActionForm key={formKey} action={action} onSuccess={() => setEditing(false)}>
        <fieldset disabled={!editing} className="readonly-fields">
          <div className="fields">
            <div className="field">
              <label htmlFor="p-name">Organisation name</label>
              <input id="p-name" name="name" required maxLength={80} defaultValue={values.name} />
            </div>
            <div className="field">
              <label htmlFor="p-contact">Primary contact</label>
              <input id="p-contact" name="contact" required maxLength={80} defaultValue={values.contact} />
            </div>
            <div className="field">
              <label htmlFor="p-email">Contact email</label>
              <input id="p-email" name="email" type="email" required defaultValue={values.email} />
            </div>
            <div className="field">
              <label htmlFor="p-focus">Solution focus</label>
              <select id="p-focus" name="focus" defaultValue={values.focus}>
                {FOCUSES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="p-goal">Joint business objective</label>
            <textarea id="p-goal" name="goal" required maxLength={500} defaultValue={values.goal} />
          </div>
        </fieldset>
        {editing && (
          <div className="actions">
            <Submit>Save changes</Submit>
            <button type="button" className="btn secondary" onClick={cancel}>
              Cancel
            </button>
          </div>
        )}
      </ActionForm>
    </section>
  );
}

/** Change your own password: shows a masked value until the pencil icon is clicked. */
export function PasswordCard({ action }: { action: Action }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className={`panel ${editing ? 'is-editing' : ''}`}>
      <div className="panelhead plain">
        <h2>Password</h2>
        <EditToggle editing={editing} onClick={() => setEditing((e) => !e)} label="password" />
      </div>
      {!editing ? (
        <div className="kv">
          <span>Sign-in password</span>
          <strong aria-label="hidden">••••••••••</strong>
        </div>
      ) : (
        <ActionForm action={action} resetOnSuccess onSuccess={() => setEditing(false)}>
          <div className="field">
            <label htmlFor="pw-current">Current password</label>
            <PasswordInput id="pw-current" name="currentPassword" autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="pw-new">New password (min. 8 characters)</label>
            <PasswordInput id="pw-new" name="newPassword" autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="pw-confirm">Confirm new password</label>
            <PasswordInput id="pw-confirm" name="confirmPassword" autoComplete="new-password" />
          </div>
          <div className="actions">
            <Submit>Change password</Submit>
            <button type="button" className="btn secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </ActionForm>
      )}
    </section>
  );
}
