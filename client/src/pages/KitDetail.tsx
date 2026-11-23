import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../auth/AuthContext';
import { api } from '../api/client';
import type { Customisation, Kit, LearningModule } from '../api/types';
import { Check, Crumbs, Kv, Loading, Modal, Note, PageHead } from '../components/ui';

export function KitDetail() {
  const { slug } = useParams();
  const user = useUser();
  const isPartner = user.role === 'PARTNER';
  const [preview, setPreview] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['kit', slug], queryFn: () => api<{ kit: Kit; customisation: Customisation | null }>(`/kits/${slug}`) });
  const learning = useQuery({ queryKey: ['enablement'], queryFn: () => api<LearningModule[]>('/enablement'), enabled: isPartner });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Note>Campaign kit not found.</Note>;
  const { kit, customisation } = q.data;
  const learned = (learning.data ?? []).every((m) => m.completed);

  return (
    <>
      <Crumbs items={[['Campaign library', '/library'], kit.title]} />
      <PageHead
        title={kit.title}
        sub={kit.description}
        action={
          isPartner && (
            <Link className="btn" to={`/library/${kit.slug}/customise`}>
              {customisation ? 'Edit customisation' : 'Use this campaign'} →
            </Link>
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
                {a.customisable && isPartner ? (
                  <Link to={`/library/${kit.slug}/customise`}>Customise →</Link>
                ) : (
                  <button className="textbutton" onClick={() => setPreview(a.name)}>
                    Preview →
                  </button>
                )}
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
              <Link className="btn secondary" to="/enablement">
                Start enablement
              </Link>
            </div>
          )}
          <div className="panel">
            <h3>Planning funded activity?</h3>
            <p className="muted">Submit your proposed activity and budget for review before committing spend.</p>
            {isPartner && (
              <Link className="btn secondary" to="/funding/new">
                Request MDF funding →
              </Link>
            )}
          </div>
        </section>
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)}>
        <p className="eyebrow">Approved asset</p>
        <h2>{preview}</h2>
        <p>Define your audience, confirm the activity date and select an approved call to action. Customise permitted partner fields and complete the readiness checklist.</p>
        <p className="muted">Asset viewer placeholder. Final campaign content is supplied by the programme owner.</p>
      </Modal>
    </>
  );
}
