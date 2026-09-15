import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function TermsPage({ copy, route }: PageProps<'terms'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2 + copy.desc3;
  const n = (v: number) => v.toLocaleString('en-US');

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 lede={copy.lede}>
        {/* 承認記録（版・承認日・確認者・文面の SHA-256）が揃うまで、下書きとして案内する（ADR 0024） */}
        {(C.PLACEHOLDER || !C.isApprovalRecorded(C.LEGAL_APPROVALS.terms)) && (
          <Note heading={copy.heading2} kind="warn">
            <p>
              {copy.p}
              <strong>{copy.strong}</strong>
              {copy.p2}
            </p>
          </Note>
        )}
      </Section>

      <Section tone="tint" navKey={file} heading={copy.heading3}>
        <Table
          headers={[copy.headers, copy.headers2]}
          rows={[
            [copy.rows, copy.rows2],
            [copy.rows3, copy.rows4],
            [copy.rows5, copy.rows6],
            [copy.rows7, copy.rows8],
            [copy.rows9, copy.rows10],
            [copy.rows11, copy.rows12],
          ]}
          caption={copy.caption}
        />
      </Section>

      <Section navKey={file} heading={copy.heading4}>
        <Table
          headers={[copy.headers, copy.headers2]}
          rows={[
            [copy.rows13, format(copy.rows14, { pRUNTERM: P.RUN_TERM })],
            [copy.rows15, copy.rows16],
            [copy.rows17, copy.rows18],
            [copy.rows19, copy.rows20],
            [copy.rows21, copy.rows22],
            [copy.rows23, copy.rows24],
          ]}
          caption={copy.caption2}
        />
      </Section>

      <Section tone="tint" heading={copy.heading5}>
        <Table
          headers={[copy.headers, copy.headers2]}
          rows={[
            [copy.rows25, copy.rows26],
            [copy.rows27, format(copy.rows28, { pOPTIONS0Price: n(P.OPTIONS[0].price) })],
            [copy.rows29, format(copy.rows30, { cRESPONSEPROMISE: C.RESPONSE_PROMISE })],
            [copy.rows31, copy.rows32],
          ]}
          caption={copy.caption3}
        />
      </Section>

      <Section heading={copy.heading6}>
        <Table
          headers={[copy.headers, copy.headers2]}
          rows={[
            [copy.rows33, copy.rows34],
            [copy.rows35, copy.rows36],
            [copy.rows37, copy.rows38],
            [copy.rows39, copy.rows40],
            [copy.rows41, copy.rows42],
            [copy.rows43, copy.rows44],
          ]}
          caption={copy.caption4}
        />
      </Section>

      <Section tone="dark" heading={copy.heading7} lede={copy.lede2}>
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
