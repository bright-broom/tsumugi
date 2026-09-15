import { LCP_SECONDS } from '@/content/measurements';
import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Note from '@/components/Note';
import Stats from '@/components/Stats';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';
import PublishedWorks from '@/views/collections/works-section';

export default function WorksPage({ copy, route, pass }: PageProps<'works'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;
  const lcp = LCP_SECONDS.toFixed(2);

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 navKey={file} lede={copy.lede} />
      <PublishedWorks />

      <Section>
        <Note heading={copy.heading2}>
          <p>{copy.p}</p>
          <p>
            {copy.p2}
            <strong>{copy.strong}</strong>
          </p>
          <ul className="plain">
            <li>{copy.li}</li>
            <li>{copy.li2}</li>
            <li>{copy.li3}</li>
            <li>{copy.li4}</li>
            <li>{copy.li5}</li>
          </ul>
        </Note>
        <Note heading={copy.heading3} kind="warn">
          <p>
            {copy.p3}
            <strong>{copy.strong2}</strong>
          </p>
          <p>
            {copy.p4}
            <strong>{copy.strong3}</strong>
          </p>
        </Note>
      </Section>

      <Section tone="tint" heading={copy.heading4} lede={copy.lede2}>
        <Stats
          items={[
            { icon: 'gauge', value: lcp, unit: copy.lcp, label: copy.itemsLabel },
            { icon: 'list-checks', value: pass, unit: copy.itemsUnit, label: copy.itemsLabel2 },
            { icon: 'code-xml', value: '0', unit: copy.itemsUnit2, label: copy.itemsLabel3 },
            { icon: 'zap', value: '0', unit: copy.itemsUnit3, label: copy.itemsLabel4 },
          ]}
        />
        <p className="works-followup">
          {copy.p5}
          <strong>{copy.strong4}</strong>
          {copy.p6}
          <strong>{copy.strong5}</strong>
        </p>
        <Note heading={copy.heading5} kind="good">
          <p>{copy.p7}</p>
          <p>
            {copy.p8}
            <a href={href('spec')}>{copy.a}</a>
            {copy.p9}
            <strong>{copy.strong6}</strong>
          </p>
        </Note>
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
