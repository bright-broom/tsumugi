import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function NotFoundPage({ copy, route }: PageProps<'notFound'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section heading={copy.heading} h1 lede={copy.lede}>
        <Cta primary={copy.primary} where={href('index')} />
      </Section>
    </Base>
  );
}
