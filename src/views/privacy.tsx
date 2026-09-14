import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import type { PageProps } from '@/content/page-props';

export default function PrivacyPage({ copy, route }: PageProps<'privacy'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 lede={copy.lede}>
        <Note heading={copy.heading2} kind="good">
          <p>
            {copy.p}
            <strong>{copy.strong}</strong>
            {copy.p2}
            <a href={href('spec')}>{copy.a}</a>
            {copy.p3}
          </p>
        </Note>
      </Section>

      <Section tone="tint" navKey={file} heading={copy.heading3}>
        <Table
          headers={[copy.headers, copy.headers2, copy.headers3]}
          rows={[
            [copy.rows, copy.rows2, copy.rows3],
            [copy.rows4, copy.rows2, copy.rows5],
            [copy.rows6, copy.rows2, copy.rows7],
            [copy.rows8, copy.rows9, copy.rows3],
            [copy.rows10, copy.rows11, copy.rows3],
            [copy.rows12, copy.rows2, copy.rows5],
          ]}
          caption={copy.caption}
        />
      </Section>

      <Section heading={copy.heading4}>
        <Table
          headers={[copy.headers4, copy.headers5]}
          rows={[
            [copy.rows13, copy.rows14],
            [copy.rows15, copy.rows16],
            [copy.rows17, copy.rows18],
            [copy.rows19, copy.rows20],
            [
              copy.rows21,
              format(copy.rows22, {
                cTEL: C.TEL,
                cEMAIL: C.EMAIL,
                cRESPONSEPROMISE: C.RESPONSE_PROMISE,
              }),
            ],
            [copy.rows23, copy.rows24],
          ]}
        />
        <Note heading={copy.heading5} kind="warn">
          <p>
            {copy.p4}
            <strong>{copy.strong2}</strong>
            {copy.p5}
          </p>
        </Note>
      </Section>

      <Section tone="tint" heading={copy.heading6}>
        <Table
          headers={['', '']}
          rows={[
            [copy.rows25, C.LEGAL_NAME],
            [
              copy.rows26,
              format(copy.rows27, {
                cPOSTALCODE: C.POSTAL_CODE,
                cADDRESSREGION: C.ADDRESS_REGION,
                cADDRESSCITY: C.ADDRESS_CITY,
                cADDRESSSTREET: C.ADDRESS_STREET,
              }),
            ],
            [
              copy.rows28,
              format(copy.rows29, { cTEL: C.TEL, cTELHOURS: C.TEL_HOURS, cEMAIL: C.EMAIL }),
            ],
            [copy.rows30, copy.rows31],
          ]}
        />
      </Section>
    </Base>
  );
}
