import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAction } from '../api/hooks';
import type { LearningModule } from '../api/types';
import { Badge, Check, Crumbs, ErrorText, Loading, PageHead, Progress } from '../components/ui';

export function Enablement() {
  const q = useQuery({ queryKey: ['enablement'], queryFn: () => api<LearningModule[]>('/enablement') });
  const [current, setCurrent] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const { run, busy, error, setError } = useAction();
  const modules = q.data ?? [];

  useEffect(() => {
    if (current === null && modules.length) setCurrent((modules.find((m) => !m.completed) ?? modules[modules.length - 1]).id);
  }, [modules, current]);

  if (q.isLoading) return <Loading />;
  const mod = modules.find((m) => m.id === current);
  const done = modules.filter((m) => m.completed).length;

  return (
    <>
      <Crumbs items={['Enablement']} />
      <PageHead title="Campaign essentials" sub="Prepare your team to position the campaign and run the activity." action={<Badge>{done === modules.length ? 'Completed' : 'In progress'}</Badge>} />
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!answer) return setError('Choose an answer.');
                  run(() => api(`/enablement/${mod.id}/complete`, { body: { answer } }), `${mod.title} completed.`).then((r) => r && setAnswer(''));
                }}
              >
                <div className="field">
                  <label htmlFor="answer">{mod.question}</label>
                  <select id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)}>
                    <option value="">Choose an answer</option>
                    {mod.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <ErrorText>{error}</ErrorText>
                <button className="btn" disabled={busy}>
                  Complete module →
                </button>
              </form>
            )}
          </section>
        )}
        <section className="panel">
          <h3>Your learning plan</h3>
          {modules.map((m) => (
            <button
              key={m.id}
              className={`module-link ${m.id === current ? 'current' : ''}`}
              onClick={() => {
                setCurrent(m.id);
                setAnswer('');
                setError('');
              }}
            >
              <Check done={m.completed}>{m.title}</Check>
            </button>
          ))}
          <Progress value={modules.length ? (done / modules.length) * 100 : 0} />
          <p className="muted small">
            {done} of {modules.length} modules completed
          </p>
          <Link className="btn secondary" to="/library">
            Return to campaigns
          </Link>
        </section>
      </div>
    </>
  );
}
