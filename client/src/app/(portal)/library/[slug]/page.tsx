import { apiGet } from '@/lib/api';
import { requireUser } from '@/lib/session';
import type { Customisation, Kit, LearningModule } from '@/lib/types';
import { Check, Crumbs, Kv, PageHead } from '@/components/ui';

export const metadata = { title: 'Campaign kit' };

export default async function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser('PARTNER', 'REVIEWER');
  const isPartner = user.role === 'PARTNER';
  const { slug } = await params;
  const [{ kit, customisation }, modules] = await Promise.all([
    apiGet<{ kit: Kit; customisation: Customisation | null }>(`/kits/${encodeURIComponent(slug)}`),
    isPartner ? apiGet<LearningModule[]>('/enablement') : Promise.resolve([] as LearningModule[]),
  ]);
  const learned = modules.every((m) => m.completed);

  return (
    <>
      <Crumbs items={[['Campaign library', '/library'], kit.title]} />
      <PageHead
        role={user.role}
        title={kit.title}
        sub={kit.description}
        action={
          isPartner && (
            <a className="btn" href={`/library/${kit.slug}/customise`}>
              {customisation ? 'Edit customisation' : 'Use this campaign'} →
            </a>
          )
        }
      />
      <div className="grid">
        <div>
          <section className="panel">
            <p className="eyebrow">Campaign brief</p>
            <h2>Start a useful customer conversation.</h2>
            <p>Run a focused activity for business and technology leaders. Use the kit to invite customers, support the session and follow up with a relevant next step.</p>
            <div className="fields">
              <Kv k="Audience" v={kit.audience} />
              <Kv k="Channel" v={kit.channel} />
              <Kv k="Estimated preparation" v={kit.prepTime} />
              <Kv k="Market / language" v={kit.market} />
            </div>
          </section>
          <section className="panel flush">
            <div className="panelhead">
              <h2>What’s in the kit</h2>
              <span className="muted">{kit.assets.length} assets</span>
            </div>
            {kit.assets.map((a, i) => (
              <div className="task" key={a.name}>
                <span className="num">0{i + 1}</span>
                <div>
                  <strong>{a.name}</strong>
                  <p>{a.detail}</p>
                </div>
                {a.customisable && isPartner ? <a href={`/library/${kit.slug}/customise`}>Customise →</a> : <span className="muted small">Approved master</span>}
              </div>
            ))}
          </section>
        </div>
        <section>
          {isPartner && (
            <div className="panel">
              <h3>Your readiness checklist</h3>
              <Check done={learned}>Complete campaign essentials</Check>
              <Check done={!!customisation}>Customise partner details</Check>
              <Check done={false}>Request funding before committing spend</Check>
              <p className="muted small spaced">
                Approved source kit · Version {kit.version}
                <br />
                Valid until {kit.expiry}
              </p>
              <a className="btn secondary" href="/enablement">
                Start enablement
              </a>
            </div>
          )}
          <div className="panel">
            <h3>Planning funded activity?</h3>
            <p className="muted">Submit your proposed activity and budget for review before committing spend.</p>
            {isPartner && (
              <a className="btn secondary" href="/funding/new">
                Request MDF funding →
              </a>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
