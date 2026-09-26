import PageIndex from '@/components/PageIndex';
import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Cta from '@/components/Cta';
import Cards from '@/components/Cards';
import type { PageProps } from '@/content/page-props';

export default function UnlimitedPage({ copy, route }: PageProps<'unlimited'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 navKey={file} lede={copy.lede}>
        <PageIndex page="unlimited" />
      </Section>

      <Section id="scope">
        <Table headers={[copy.headers]} rows={P.UPDATE_IN.map((x) => [`<strong>${x}</strong>`])} />
        <Table
          headers={[copy.headers2, copy.headers3, copy.headers4]}
          rows={P.UPDATE_OUT.map(([n, d, p]) => [`<strong>${n}</strong>`, d, p])}
        />
        <Note heading={copy.heading2} kind="warn">
          <p>{P.UPDATE_NOTE}</p>
        </Note>
      </Section>

      <Section id="support" tone="tint" heading={copy.heading3}>
        <Table
          headers={[copy.headers5, copy.headers6]}
          rows={P.RUN.map((r) => [r.name, r.lede])}
          caption={copy.caption}
        />
        <Note heading={copy.heading4} kind="good">
          <p>
            {copy.p2 +
              format(copy.p3, { pRunRunLightPrice: P.yen(P.run('run_light').price) }) +
              copy.p4}
            <strong>{copy.strong}</strong>
          </p>
        </Note>
      </Section>

      <Section id="request" heading={copy.heading5}>
        <Cards items={copy.rules} />
      </Section>

      <Section heading={copy.heading6}>
        <Cta />
      </Section>
    </Base>
  );
}
