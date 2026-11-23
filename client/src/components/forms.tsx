'use client';

/**
 * Small client-side pieces used by server-rendered pages:
 * forms that post to Server Actions and show the result, submit buttons,
 * file pickers that upload on choose, and selects that submit their GET form.
 */
import { startTransition, useActionState, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/actions';

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * A form that posts to a Server Action and shows its error or success message.
 * Submitted manually (not through the form's action prop) so typed values stay
 * in the fields when the server reports a problem.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  inline,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  /** Ask before submitting (e.g. delete). */
  confirm?: string;
  /** Show messages next to the controls instead of under them. */
  inline?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter as HTMLButtonElement | null);
        startTransition(() => dispatch(fd));
      }}
    >
      <fieldset disabled={pending} className={inline ? 'inline-fieldset' : undefined}>
        {children}
      </fieldset>
      {state.error && (
        <p className="error" role="alert" key={state.at}>
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="success" role="status" key={state.at}>
          {state.ok}
        </p>
      )}
    </form>
  );
}

/** Submit button that shows progress. Use name="intent" + value to tell actions apart. */
export function Submit({ children, value, secondary, danger, small }: { children: ReactNode; value?: string; secondary?: boolean; danger?: boolean; small?: boolean }) {
  const { pending } = useFormStatus();
  const cls = small ? 'textbutton' + (danger ? ' danger' : '') : `btn${secondary ? ' secondary' : ''}${danger ? ' danger' : ''}`;
  return (
    <button className={cls} type="submit" name={value ? 'intent' : undefined} value={value} disabled={pending}>
      {children}
    </button>
  );
}

/** File picker that uploads as soon as files are chosen. Must sit inside an ActionForm. */
export function UploadField({ label }: { label: string }) {
  return (
    <label className="upload">
      {label}
      <input
        type="file"
        name="files"
        multiple
        onChange={(e) => {
          if (e.currentTarget.files?.length) e.currentTarget.form?.requestSubmit();
        }}
      />
    </label>
  );
}

/** A select inside a plain GET form that reloads the page when changed. */
export function AutoSubmitSelect({ name, value, options, label }: { name: string; value: string; options: [string, string][]; label: string }) {
  return (
    <select aria-label={label} name={name} defaultValue={value} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
