import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Icon from '@/components/Icon';
import PhoneLink from '@/components/PhoneLink';
import type { PageProps } from '@/content/page-props';

export default function NotFoundPage({ copy, route }: PageProps<'notFound'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.code} heading={copy.heading} h1 lede={copy.lede}>
        <div className="btns">
          <a className="btn btn-1" href={href('index')}>
            <Icon name="arrow-right" sm />
            {copy.primary}
          </a>
          <PhoneLink className="btn btn-2" />
        </div>
      </Section>
    </Base>
  );
}
