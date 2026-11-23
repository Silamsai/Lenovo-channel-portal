'use client';

import { useState } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';

/** Password field with an eye button to show or hide what was typed. */
export function PasswordInput({ id, name, autoComplete = 'current-password' }: { id: string; name: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input id={id} name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <LuEyeOff aria-hidden /> : <LuEye aria-hidden />}
      </button>
    </div>
  );
}
