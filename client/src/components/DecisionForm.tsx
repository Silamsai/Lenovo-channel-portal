import type { FormState } from '@/lib/actions';
import { ActionForm, Submit } from './forms';

type Decision = 'Approved' | 'Changes requested' | 'Rejected';
const LABEL: Record<Decision, string> = { Approved: 'Approve', 'Changes requested': 'Request changes', Rejected: 'Reject' };

/** Reviewer decision: note plus one button per allowed outcome. */
export function DecisionForm({ action, options }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; options: Decision[] }) {
  return (
    <ActionForm action={action}>
      <div className="field">
        <label htmlFor="decision-note">Decision note (required unless approving)</label>
        <textarea id="decision-note" name="note" maxLength={1000} />
      </div>
      <div className="actions">
        {options.map((o, i) => (
          <Submit key={o} value={o} secondary={i > 0}>
            {LABEL[o]}
          </Submit>
        ))}
      </div>
    </ActionForm>
  );
}
