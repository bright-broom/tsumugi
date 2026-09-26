import PageIndex from '@/components/PageIndex';
import { SubsidyBar } from '@/components/diagrams/SubsidyBar';
import { SubsidyTimeline } from '@/components/diagrams/SubsidyTimeline';
import { esc } from '@/lib/raw';
import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Cards from '@/components/Cards';
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
      >
        <PageIndex page="subsidy" />
      </Section>

      <Section id="package" heading={copy.heading2}>
        <SubsidyBar total={sd.total} web={sd.web} pr={sd.pr} grant={sd.grant} net={sd.net} />
        <Table
          headers={[copy.headers, copy.headers2, copy.headers3]}
          rows={S.package.map(([k, d, a]) => [k, d, a.toLocaleString('en-US')])}
          caption={copy.caption}
          foot={format(copy.foot, { sdTotal: P.yen(sd.total) })}
        />

        <Note heading={copy.heading3}>
          <p>
            {copy.p}
            <strong>{copy.strong}</strong>
            {copy.p2}
          </p>
        </Note>
      </Section>

      <Section id="conditions" tone="tint" heading={copy.heading4}>
        <Cards
          items={copy.cautions.map((c, i) =>
            i === 0
              ? {
                  ...c,
                  desc: format(c.desc, {
                    rate: esc(S.adoption_rate),
                    detail: esc(S.adoption_detail),
                  }),
                }
              : c,
          )}
        />
      </Section>

      <Section id="schedule" eyebrow={copy.eyebrow2} heading={copy.heading8}>
        <SubsidyTimeline form4={S.form4_deadline} deadline={S.deadline} />
        <Note heading={copy.heading9}>
          <p>
            {copy.p13}
            <strong>{copy.strong8}</strong>
          </p>
        </Note>
      </Section>

      <Section id="support" tone="tint" heading={copy.heading10}>
        <p>
          {copy.p15}
          <strong>{copy.strong9}</strong>
          {copy.p16}
        </p>
      </Section>

      <Section heading={copy.heading11}>
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
