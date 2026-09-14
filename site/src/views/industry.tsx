import { pathForFile } from '@/routing/registry';
import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import { IND_DATA } from '@/content/industries';
import { INDUSTRIES, IND_IC } from '@/content/nav';
import { esc, raw } from '@/lib/raw';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Note from '@/components/Note';
import Icon from '@/components/Icon';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function IndustryPage({ copy, route }: PageProps<'industry'>) {
  const file = ROUTES[route].file;
  const d = IND_DATA[file]!;
  const plan = P.build(d.plan);
  const run = P.run('run_basic');
  const payment = P.paymentSchedule(plan.price);
  const others = INDUSTRIES.filter(([u]) => u !== file);

  const title = format(copy.title, { dH1: d.h1, cBRANDT: C.BRAND_T });
  const desc =
    format(copy.desc, { dName: d.name }) +
    format(copy.desc2, {
      planName: plan.name,
      planPages: plan.pages,
      planPrice: P.yen(plan.price),
    }) +
    copy.desc3;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section
        eyebrow={format(copy.eyebrow, { dName: d.name })}
        heading={d.h1}
        h1
        lede={format(copy.lede, { dName: d.name })}
      >
        <p>
          {format(copy.p, { dName: d.name })}
          <strong>{d.median}</strong>
          {copy.p2}
        </p>
      </Section>

      {/* 業種の話に入る前に、業種を問わない1番の主張を1枚はさむ */}
      <Section tone="tint">
        <Note heading={copy.heading} kind="good">
          <p>
            {copy.p3}
            <strong>{copy.strong}</strong>
          </p>
          <p>
            {copy.p4}
            <a href={href('owned')}>{copy.a}</a>
          </p>
        </Note>
      </Section>

      <Section heading={copy.heading2}>
        <ol className="steps">
          {d.must.map(([t, dd]) => (
            <li key={t}>
              <b dangerouslySetInnerHTML={raw(t)} />
              <div className="d" dangerouslySetInnerHTML={raw(dd)} />
            </li>
          ))}
        </ol>
      </Section>

      <Section heading={copy.heading3}>
        <Note heading={format(copy.heading4, { dName: d.name })} kind="bad">
          <ul className="plain">
            {d.skip.map(([t, dd]) => (
              <li key={t} dangerouslySetInnerHTML={raw(`<strong>${esc(t)}</strong><br>${dd}`)} />
            ))}
          </ul>
        </Note>
      </Section>

      <Section eyebrow={copy.eyebrow2} heading={copy.heading5}>
        <p dangerouslySetInnerHTML={raw(d.cost)} />
        <div className="btns">
          <a className="btn btn-2" href={href('cost-cut')}>
            {copy.btn}
          </a>
        </div>
      </Section>

      <Section heading={copy.heading6}>
        <p>
          {format(copy.p5, { dName: d.name })}
          <strong>{format(copy.strong2, { planName: plan.name, planPages: plan.pages })}</strong>
          {copy.p6}
        </p>
        <div className="ledger">
          <div className="hd">{format(copy.hd, { planName: plan.name, runName: run.name })}</div>
          <div className="row">
            <span>{copy.span}</span>
            <span className="v tnum">{P.yen(plan.price)}</span>
          </div>
          <div className="row">
            <span>{copy.span2}</span>
            <span className="v tnum">{P.yen(payment.deposit)}</span>
          </div>
          <div className="row">
            <span>{copy.span3}</span>
            <span className="v tnum">{P.yen(payment.acceptance)}</span>
          </div>
          <div className="row">
            <span>{copy.span4}</span>
            <span className="v tnum">{P.yen(run.price)}</span>
          </div>
          <div className="row net">
            <span>{copy.span5}</span>
            <span className="v tnum">{P.yen(P.supportMonthlyTotal('run_basic'))}</span>
          </div>
        </div>
        <p className="dim">{copy.dim}</p>
        <div className="btns">
          <a className="btn btn-2" href={href('price')}>
            {copy.btn2}
          </a>
          <a className="btn btn-2" href={href('subsidy')}>
            {copy.btn3}
          </a>
        </div>
      </Section>

      <Section heading={copy.heading7}>
        <div className="cq">
          <div className="inds">
            {others.map(([u, nm, dd]) => (
              <a className="ind" href={pathForFile(u)} key={u}>
                <span className="n">
                  <Icon name={IND_IC[u]!} sm />
                  {nm}
                </span>
                <span className="p">{dd}</span>
              </a>
            ))}
          </div>
        </div>
      </Section>

      <Section heading={copy.heading8}>
        <Cta />
      </Section>
    </Base>
  );
}
