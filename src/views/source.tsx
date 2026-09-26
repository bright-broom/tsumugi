import PageIndex from '@/components/PageIndex';
import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Cards from '@/components/Cards';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function SourcePage({ copy, route }: PageProps<'source'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 lede={copy.lede}>
        <PageIndex page="source" />
      </Section>

      <Section id="delivery" heading={copy.heading2}>
        <Cards cls="g4" items={copy.delivery} />
        <Note heading={copy.heading3} kind="good">
          <p>
            {copy.p}
            <strong>{copy.strong}</strong>
            {copy.p3}
          </p>
        </Note>
      </Section>

      <Section reading id="handover" tone="tint" eyebrow={copy.eyebrow2} heading={copy.heading4}>
        <Table
          headers={[copy.headers3, copy.headers2]}
          rows={[
            [copy.rows9, copy.rows10],
            [copy.rows13, copy.rows14],
            [copy.rows17, copy.rows18],
          ]}
        />
        <p className="fine-note">
          {copy.p5}
          <strong>{copy.strong2}</strong>
        </p>
      </Section>

      <Section reading id="formats" eyebrow={copy.eyebrow3} heading={copy.heading6}>
        <Table
          headers={[copy.headers4, copy.headers5, copy.headers6]}
          rows={[
            [copy.rows19, copy.rows20, copy.rows21],
            [copy.rows23, copy.rows24, copy.rows25],
            [copy.rows26, copy.rows27, copy.rows28],
          ]}
        />
        <Note heading={copy.heading7}>
          <p>
            {copy.p6}
            <strong>{copy.strong3}</strong>
          </p>
        </Note>
      </Section>

      <Section reading heading={copy.heading8}>
        <Cta />
      </Section>
    </Base>
  );
}
