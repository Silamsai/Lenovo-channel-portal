import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { completeModule } from '@/lib/actions';
import { requireUser } from '@/lib/session';
import type { LearningModule } from '@/lib/types';
import { Badge, Check, Crumbs, PageHead, Progress } from '@/components/ui';
import { ActionForm, Submit } from '@/components/forms';

export const metadata = { title: 'Enablement' };

/** Each module is its own page: /enablement?module=3 */
export default async function EnablementPage({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const user = await requireUser('PARTNER');
  const modules = await apiGet<LearningModule[]>('/enablement');
  const wanted = Number((await searchParams).module);
  const mod = modules.find((m) => m.id === wanted) ?? modules.find((m) => !m.completed) ?? modules[modules.length - 1];
  const done = modules.filter((m) => m.completed).length;

  return (
    <>
      <Crumbs items={['Enablement']} />
      <PageHead role={user.role} title="Enablement" sub="Campaign essentials to prepare your team to position the campaign and run the activity." action={<Badge>{done === modules.length ? 'Completed' : 'In progress'}</Badge>} />
      <div className="grid">
        {mod && (
          <section className="panel">
            <p className="eyebrow">
              Module 0{mod.order} / 0{modules.length} · {mod.minutes} minutes
            </p>
            <h2>{mod.title}</h2>
            <p>{mod.body}</p>
            <h3>Before you launch</h3>
            {mod.checks.map((c, i) => (
              <div className="check" key={c}>
                0{i + 1} &nbsp; {c}
              </div>
            ))}
            <hr className="rule" />
            {mod.completed ? (
              <p>
                <Badge>Completed</Badge>
              </p>
            ) : (
              <ActionForm action={completeModule.bind(null, mod.id)}>
                <div className="field">
                  <label htmlFor="answer">{mod.question}</label>
                  <select id="answer" name="answer" defaultValue="">
                    <option value="">Choose an answer</option>
                    {mod.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Submit>Complete module →</Submit>
              </ActionForm>
            )}
          </section>
        )}
        <section className="panel">
          <h3>Your learning plan</h3>
          {modules.map((m) => (
            <Link key={m.id} href={`/enablement?module=${m.id}`} className={`module-link ${m.id === mod?.id ? 'current' : ''}`}>
              <Check done={m.completed}>{m.title}</Check>
            </Link>
          ))}
          <Progress value={modules.length ? (done / modules.length) * 100 : 0} />
          <p className="muted small">
            {done} of {modules.length} modules completed
          </p>
          <Link className="btn secondary" href="/library">
            Return to campaigns
          </Link>
        </section>
      </div>
    </>
  );
}
