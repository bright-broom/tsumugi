import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function SourcePage({ copy, route }: PageProps<'source'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 lede={copy.lede} />

      <Section heading={copy.heading2}>
        <Table
          headers={[copy.headers, copy.headers2]}
          rows={[
            [copy.rows, copy.rows2],
            [copy.rows3, copy.rows4],
            [copy.rows5, copy.rows6],
            [copy.rows7, copy.rows8],
          ]}
        />
        <Note heading={copy.heading3} kind="good">
          <p>{copy.p}</p>
          <p>
            {copy.p2}
            <strong>{copy.strong}</strong>
            {copy.p3}
          </p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow={copy.eyebrow2} heading={copy.heading4}>
        <p>{copy.p4}</p>
        <Table
          headers={[copy.headers3, copy.headers2]}
          rows={[
            [copy.rows9, copy.rows10 + copy.rows11 + copy.rows12],
            [copy.rows13, copy.rows14 + copy.rows15 + copy.rows16],
            [copy.rows17, copy.rows18],
          ]}
        />
        <Note heading={copy.heading5}>
          <p>
            {copy.p5}
            <strong>{copy.strong2}</strong>
          </p>
        </Note>
      </Section>

      <Section eyebrow={copy.eyebrow3} heading={copy.heading6}>
        <Table
          headers={[copy.headers4, copy.headers5, copy.headers6]}
          rows={[
            [copy.rows19, copy.rows20, copy.rows21 + copy.rows22],
            [copy.rows23, copy.rows24, copy.rows25],
            [copy.rows26, copy.rows27, copy.rows28],
            [copy.rows29, copy.rows30, copy.rows31],
          ]}
        />
        <Note heading={copy.heading7}>
          <p>
            {copy.p6}
            <strong>{copy.strong3}</strong>
          </p>
        </Note>
      </Section>

      <Section heading={copy.heading8}>
        <Cta />
      </Section>
    </Base>
  );
}
