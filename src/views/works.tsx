import { LCP_RECORDED_ON, LCP_SECONDS } from '@/content/measurements';
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

export default function WorksPage({ copy, route, verification }: PageProps<'works'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;
  const lcp = LCP_SECONDS.toFixed(2);
  // 件数は同じコミットの全項目・FAIL 0 の記録があるときだけ出す。無ければ「—」（ADR 0025）
  const verificationNote = verification
    ? format(copy.verifiedNote, { ...verification })
    : copy.unverifiedNote;
  const lcpNote = format(copy.lcpNote, { recordedOn: LCP_RECORDED_ON });

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 navKey={file} lede={copy.lede} />

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
            {
              icon: 'gauge',
              value: lcp,
              unit: copy.lcp,
              label: format(copy.itemsLabel, { recordedOn: LCP_RECORDED_ON }),
            },
            {
              icon: 'list-checks',
              value: verification?.pass ?? '—',
              unit: copy.itemsUnit,
              label: copy.itemsLabel2,
            },
            { icon: 'code-xml', value: '0', unit: copy.itemsUnit2, label: copy.itemsLabel3 },
            { icon: 'zap', value: '0', unit: copy.itemsUnit3, label: copy.itemsLabel4 },
          ]}
        />
        <p className="works-followup">
          {`${verificationNote}${lcpNote}${copy.p6}`}
          <strong>{copy.strong5}</strong>
        </p>
        <Note heading={copy.heading5} kind="good">
          <p>{copy.p7}</p>
          <p>
            {copy.p8}
            <a href={href('spec')}>{copy.a}</a>
            {copy.p9}
          </p>
          {C.SOURCE_REPOSITORY_URL ? (
            <p>
              {copy.sourcePublic}
              <a href={C.SOURCE_REPOSITORY_URL}>{copy.sourceLink}</a>
              {copy.sourcePublic2}
            </p>
          ) : (
            <p>{copy.sourcePrivate}</p>
          )}
          <p>
            {copy.customerSource}
            <a href={href('source')}>{copy.customerSourceLink}</a>
            {copy.customerSource2}
          </p>
        </Note>
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
