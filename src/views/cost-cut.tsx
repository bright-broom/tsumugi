import PageIndex from '@/components/PageIndex';
import { MoneyFlow } from '@/components/diagrams/MoneyFlow';
import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Cta from '@/components/Cta';
import StepRail from '@/components/StepRail';
import { raw } from '@/lib/raw';
import type { PageProps } from '@/content/page-props';

export default function CostCutPage({ copy, route }: PageProps<'costCut'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;
  const runStd = P.withTax(P.supportMonthlyTotal('run_basic'));
  const n = (v: number) => v.toLocaleString('en-US');
  const rows = P.PORTAL_TABELOG.map(([name, amount], i) => {
    const cut = i > 0 ? P.PORTAL_TABELOG[i - 1]![1] - amount : null;
    return [
      name,
      amount ? n(amount) : '0',
      cut === null ? '—' : n(cut),
      cut === null ? '—' : cut >= runStd ? copy.rows : copy.rows2,
    ];
  }).reverse();
  const people = Math.ceil(runStd / P.PORTAL_FEE_DINNER);

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 navKey={file} lede={copy.lede}>
        <PageIndex page="costCut" />
      </Section>

      <Section id="costs" heading={copy.heading2}>
        <MoneyFlow portal={27_500} run={runStd} />
        <Table
          headers={[copy.headers, copy.headers2, copy.headers3, copy.headers4]}
          rows={rows}
          caption={copy.caption}
          foot={format(copy.foot, {
            pPORTALFEELUNCH: P.PORTAL_FEE_LUNCH,
            pPORTALFEEDINNER: P.PORTAL_FEE_DINNER,
          })}
        />

        <Note heading={copy.heading3} kind="good">
          <p>
            {copy.p}
            <strong>{copy.strong}</strong>
            {copy.p2}
            <strong>{copy.strong2}</strong>
            {copy.p3}
          </p>
        </Note>
        <Note heading={copy.heading4} kind="warn">
          <p>
            {format(copy.p4, { runStd: n(runStd) })}
            <strong>{copy.strong3}</strong>
          </p>
        </Note>
      </Section>

      <Section id="fees" tone="tint" eyebrow={copy.eyebrow2} heading={copy.heading5}>
        <p>
          {format(copy.p5, { pPORTALFEEDINNER: P.PORTAL_FEE_DINNER })}
          <strong>{copy.strong4}</strong>
          {format(copy.p7, { runStd: n(runStd) })}
          <strong>{format(copy.strong5, { people: people })}</strong>
          {copy.p8}
        </p>
      </Section>

      <Section eyebrow={copy.eyebrow3} heading={copy.heading6}>
        <Note heading={copy.heading7} kind="warn">
          <p>
            {copy.p9}
            <strong>{copy.strong6}</strong>
          </p>
        </Note>
        <p>{copy.p11}</p>
        <ul className="plain">
          <li>
            <strong>{copy.strong7}</strong>
            {copy.li}
          </li>
          <li>
            <strong>{copy.strong8}</strong>
            {copy.li2}
          </li>
        </ul>
      </Section>

      <Section tone="tint" eyebrow={copy.eyebrow4} heading={copy.heading8}>
        <p>
          {copy.p12}
          <strong>{copy.strong9}</strong>
          {copy.p13}
          <strong>{copy.strong10}</strong>
        </p>
      </Section>

      <Section id="approach" eyebrow={copy.eyebrow5} heading={copy.heading9}>
        <StepRail label={copy.stepsLabel} steps={copy.steps} />
        <p className="fine-note" dangerouslySetInnerHTML={raw(copy.stepsNote)} />
        <Note heading={copy.heading10} kind="bad">
          <ul className="plain">
            <li>{copy.li3}</li>
            <li>{copy.li4}</li>
            <li>{copy.li5}</li>
            <li>{copy.li6}</li>
          </ul>
          <p>
            <strong>{copy.strong14}</strong>
          </p>
        </Note>
      </Section>

      <Section heading={copy.heading11}>
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
