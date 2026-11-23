import { apiGet } from '@/lib/api';
import { saveCustomisation } from '@/lib/actions';
import { brand } from '@/lib/brand';
import { requireUser } from '@/lib/session';
import type { Customisation, Kit } from '@/lib/types';
import { Crumbs, PageHead } from '@/components/ui';
import { CustomiseForm } from './CustomiseForm';

export const metadata = { title: 'Customise campaign' };

export default async function CustomisePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser('PARTNER');
  const { slug } = await params;
  const { kit, customisation } = await apiGet<{ kit: Kit; customisation: Customisation | null }>(`/kits/${encodeURIComponent(slug)}`);
  const initial = customisation ?? { company: user.partner?.name ?? '', contactEmail: '', cta: 'Register for the webinar', url: 'https://' };

  return (
    <>
      <Crumbs items={[['Campaign library', '/library'], [kit.title, `/library/${kit.slug}`], 'Customise']} />
      <PageHead role={user.role} title="Make the campaign yours." sub="Update the permitted fields. Brand elements and approved claims stay locked." />
      <CustomiseForm
        action={saveCustomisation.bind(null, kit.slug)}
        initial={{ company: initial.company, contactEmail: initial.contactEmail, cta: initial.cta, url: initial.url }}
        brandName={brand.name}
        kitTitle={kit.title}
        exportHref={customisation ? `/download/kits/${kit.slug}/export` : null}
      />
    </>
  );
}
