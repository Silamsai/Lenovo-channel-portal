import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { requestBenefit } from '@/lib/actions';
import { requireUser } from '@/lib/session';
import type { BenefitsData } from '@/lib/types';
import { Crumbs, PageHead } from '@/components/ui';
import { ActionForm, Submit } from '@/components/forms';

export const metadata = { title: 'Request benefit' };

export default async function RequestBenefitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('PARTNER');
  const id = Number((await params).id);
  const data = await apiGet<BenefitsData>('/benefits');
  const benefit = data.items.find((b) => b.id === id);
  if (!benefit) notFound();

  return (
    <>
      <Crumbs items={[['Benefits', '/benefits'], benefit.name]} />
      <PageHead role={user.role} title={`Request ${benefit.name.toLowerCase()}`} sub={`${benefit.description} ${benefit.limitText}.`} />
      <section className="panel narrow">
        <ActionForm action={requestBenefit.bind(null, benefit.id)}>
          <div className="field">
            <label htmlFor="b-note">What do you need?</label>
            <textarea id="b-note" name="note" required maxLength={500} />
          </div>
          <div className="actions">
            <Submit>Send request →</Submit>
            <a className="btn secondary" href="/benefits">
              Cancel
            </a>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
