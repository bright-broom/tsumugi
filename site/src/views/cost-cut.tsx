import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import * as D from '@/content/diagrams';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Figure from '@/components/Figure';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function CostCutPage({ copy, route }: PageProps<'costCut'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;
  const runStd = P.run('run_standard').price;
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
  const people = Math.floor(runStd / P.PORTAL_FEE_DINNER) + 1;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 navKey={file} lede={copy.lede} />

      <Section heading={copy.heading2}>
        <Table
          headers={[copy.headers, copy.headers2, copy.headers3, copy.headers4]}
          rows={rows}
          caption={copy.caption}
          foot={format(copy.foot, {
            pPORTALFEELUNCH: P.PORTAL_FEE_LUNCH,
            pPORTALFEEDINNER: P.PORTAL_FEE_DINNER,
          })}
        />
        <Figure svg={D.moneyFlow(27_500, runStd)} />
        <Note heading={copy.heading3} kind="good">
          <p>
            {copy.p}
            <strong>{copy.strong}</strong>
            {copy.p2}
            <strong>{copy.strong2}</strong>
          </p>
          <p>{copy.p3}</p>
        </Note>
        <Note heading={copy.heading4} kind="warn">
          <p>
            {format(copy.p4, { runStd: n(runStd) })}
            <strong>{copy.strong3}</strong>
          </p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow={copy.eyebrow2} heading={copy.heading5}>
        <p>
          {format(copy.p5, { pPORTALFEEDINNER: P.PORTAL_FEE_DINNER })}
          <strong>{copy.strong4}</strong>
          {format(copy.p6, { pPORTALFEEDINNER: P.PORTAL_FEE_DINNER })}
        </p>
        <p>
          {format(copy.p7, { runStd: n(runStd) })}
          <strong>{format(copy.strong5, { people: people })}</strong>
          {copy.p8}
        </p>
      </Section>

      <Section eyebrow={copy.eyebrow3} heading={copy.heading6}>
        <Note heading={copy.heading7} kind="warn">
          <p>{copy.p9}</p>
          <p>
            {copy.p10}
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
        <p>{copy.p14}</p>
      </Section>

      <Section eyebrow={copy.eyebrow5} heading={copy.heading9}>
        <ol className="steps">
          <li>
            <b>{copy.b}</b>
            <div className="d">{copy.d}</div>
          </li>
          <li>
            <b>{copy.b2}</b>
            <div className="d">
              {copy.d2}
              <strong>{copy.strong11}</strong>
            </div>
          </li>
          <li>
            <b>{copy.b3}</b>
            <div className="d">{copy.d3}</div>
          </li>
          <li>
            <b>{copy.b4}</b>
            <div className="d">
              <strong>{copy.strong12}</strong>
              {copy.d4}
            </div>
          </li>
          <li>
            <b>{copy.b5}</b>
            <div className="d">
              {copy.d5}
              <strong>{copy.strong13}</strong>
            </div>
          </li>
        </ol>
        <Note heading={copy.heading10} kind="bad">
          <p>{copy.p15}</p>
          <ul className="plain">
            <li>{copy.li3}</li>
            <li>{copy.li4}</li>
            <li>{copy.li5}</li>
            <li>{copy.li6}</li>
          </ul>
          <p>
            <strong>{copy.strong14}</strong>
            {copy.p16}
          </p>
        </Note>
      </Section>

      <Section heading={copy.heading11}>
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
