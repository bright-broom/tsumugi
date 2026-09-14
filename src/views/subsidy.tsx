import { esc, raw } from '@/lib/raw';
import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import * as D from '@/content/diagrams';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Acc from '@/components/Acc';
import Figure from '@/components/Figure';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function SubsidyPage({ copy, route }: PageProps<'subsidy'>) {
  const file = ROUTES[route].file;
  const S = P.SUBSIDY;
  const sd = P.subsidyCalc();
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc =
    format(copy.desc, { sRound: S.round }) +
    format(copy.desc2, { sdTotal: P.yen(sd.total), sdNet: P.yen(sd.net) }) +
    format(copy.desc3, { sAdoptionRate: S.adoption_rate });

  return (
    <Base file={file} title={title} desc={desc}>
      <Section
        eyebrow={copy.eyebrow}
        heading={format(copy.heading, { sdTotal: P.yen(sd.total), sdNet: P.yen(sd.net) })}
        h1
        navKey={file}
        lede={format(copy.lede, {
          sName: S.name,
          sRound: S.round,
          sRateText: S.rate_text,
          sCap: P.yen(S.cap),
          sWebCap: P.yen(S.web_cap),
        })}
      />

      <Section heading={copy.heading2}>
        <Table
          headers={[copy.headers, copy.headers2, copy.headers3]}
          rows={S.package.map(([k, d, a]) => [k, d, a.toLocaleString('en-US')])}
          caption={copy.caption}
          foot={format(copy.foot, { sdTotal: P.yen(sd.total) })}
        />
        <Figure svg={D.subsidyBar(sd.total, sd.web, sd.pr, sd.grant, sd.net)} />
        <Note heading={copy.heading3}>
          <p>
            {copy.p}
            <strong>{copy.strong}</strong>
            {copy.p2}
            <strong>{copy.strong2}</strong>
          </p>
        </Note>
      </Section>

      <Section tone="tint" heading={copy.heading4}>
        <Note heading={copy.heading5} kind="bad">
          <p
            dangerouslySetInnerHTML={raw(
              format(copy.adoption, { rate: esc(S.adoption_rate), detail: esc(S.adoption_detail) }),
            )}
          />
          <p>
            <strong>{copy.strong3}</strong>
            {copy.p5}
          </p>
        </Note>
        <Note heading={copy.heading6} kind="warn">
          <p>
            {copy.p6}
            <strong>{copy.strong4}</strong>
            {copy.p7}
          </p>
        </Note>
        <Note heading={copy.heading7}>
          <p>
            {copy.p8}
            <strong>{copy.strong5}</strong>
            {copy.p9}
          </p>
          <p>
            {copy.p10}
            <strong>{copy.strong6}</strong>
            {copy.p11}
            <strong>{copy.strong7}</strong>
            {copy.p12}
          </p>
        </Note>
      </Section>

      <Section eyebrow={copy.eyebrow2} heading={copy.heading8}>
        <Figure svg={D.subsidyTimeline(S.form4_deadline, S.deadline)} />
        <Acc summary={copy.summary}>
          <ul className="plain">
            <li>
              <b>{copy.b}</b>
              {copy.li}
            </li>
            <li>
              <b>{copy.b2}</b>
              {copy.li2}
            </li>
            <li>
              <b>{copy.b3}</b>
              {copy.li3}
            </li>
            <li>
              <b>{copy.b4}</b>
              {copy.li4}
            </li>
            <li>
              <b>{copy.b5}</b>
              {copy.li5}
            </li>
            <li>
              <b>{copy.b6}</b>
              {copy.li6}
            </li>
          </ul>
        </Acc>
        <Note heading={copy.heading9}>
          <p>
            {copy.p13}
            <strong>{copy.strong8}</strong>
            {copy.p14}
          </p>
        </Note>
      </Section>

      <Section tone="tint" heading={copy.heading10}>
        <p>
          {copy.p15}
          <strong>{copy.strong9}</strong>
          {copy.p16}
        </p>
        <p>{copy.p17}</p>
      </Section>

      <Section heading={copy.heading11}>
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
