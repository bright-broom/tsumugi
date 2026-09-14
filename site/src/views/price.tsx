import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import PhoneLink from '@/components/PhoneLink';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import * as D from '@/content/diagrams';
import { NOT_SELLING } from '@/content/spec';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Calc from '@/components/Calc';
import Entry from '@/components/Entry';
import Plans from '@/components/Plans';
import Figure from '@/components/Figure';
import type { PageProps } from '@/content/page-props';

export default function PricePage({ copy, route }: PageProps<'price'>) {
  const file = ROUTES[route].file;
  const n = (v: number) => v.toLocaleString('en-US');
  const std = P.build('standard');
  const basic = P.build('basic');
  const rows = P.compareRows();
  const last = rows[2]!;
  const title = format(copy.title, { pSINGLEPrice: n(P.SINGLE.price), cBRANDT: C.BRAND_T });
  const desc =
    format(copy.desc, { pSINGLEPrice: n(P.SINGLE.price), stdPrice: n(std.price) }) +
    format(copy.desc2, { pCOMPAREMONTHS: P.COMPARE_MONTHS }) +
    copy.desc3;
  const rivalTotal = 29_800 * 24;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section
        eyebrow={copy.eyebrow}
        h1
        navKey={file}
        heading={format(copy.heading, { pSINGLEPrice: n(P.SINGLE.price), stdPrice: n(std.price) })}
        lede={copy.lede}
      >
        <p>
          <strong>{copy.strong}</strong>
          {copy.p}
        </p>
        <Entry full />
        <h3 style={{ margin: '48px 0 18px' }}>{copy.h3}</h3>
        <Plans />
      </Section>

      <Section
        tone="tint"
        eyebrow={copy.eyebrow2}
        heading={format(copy.heading2, { pCOMPAREMONTHS: P.COMPARE_MONTHS })}
        lede={format(copy.lede2, { pCOMPAREMONTHS: P.COMPARE_MONTHS })}
      >
        <Table
          headers={[copy.headers, copy.headers2, C.BRAND]}
          rows={rows.map((r) => [
            format(copy.rows, { rSubPages: r.sub_pages }),
            format(copy.rows2, {
              rSubMonthly: n(r.sub_monthly),
              pSUBSMARKET0Init: n(P.SUBS_MARKET[0].init),
              rSubTotal: n(r.sub_total),
            }),
            format(copy.rows3, { rOurPrice: n(r.our_price), rOurRun: n(r.our_run) }) +
              format(copy.rows4, { rOurTotal: n(r.our_total) }) +
              (r.diff < 0
                ? format(copy.rows5, { rDiff: n(-r.diff) })
                : format(copy.rows6, { rDiff: n(r.diff) })),
          ])}
          caption={format(copy.caption, {
            pSUBSSOURCE: P.SUBS_SOURCE,
            pSUBSMINTERM: P.SUBS_MIN_TERM,
            pSUBSTRANSFERMONTHS: P.SUBS_TRANSFER_MONTHS,
          })}
          foot={copy.foot}
        />
        <Note heading={copy.heading3} kind="good">
          <p>
            {format(copy.p2, {
              lastSubPages: last.sub_pages,
              pCOMPAREMONTHS: P.COMPARE_MONTHS,
              lastDiff: n(last.diff),
              mathFloorLastDiffPCOMPAREMONTHS: n(Math.floor(last.diff / P.COMPARE_MONTHS)),
            })}
          </p>
          <p>
            {copy.p3}
            <strong>{format(copy.strong2, { pOPTIONS1Price: n(P.OPTIONS[1].price) })}</strong>
            {copy.p4}
            <strong>{copy.strong3}</strong>
            {copy.p4}
            <strong>{copy.strong4}</strong>
            {copy.p4}
            <strong>{copy.strong5}</strong>
            {copy.p5}
          </p>
        </Note>
      </Section>

      <Section
        tone="tint"
        eyebrow={copy.eyebrow3}
        heading={copy.heading4}
        lede={format(copy.lede3, { stdPrice: n(std.price) })}
      >
        <Calc
          title={format(copy.title2, { stdPrice: n(std.price) })}
          rows={[
            { label: copy.rowsLabel, value: '—', cls: 'small', sub: copy.rowsSub },
            { label: copy.rowsLabel2, value: copy.rowsValue, cls: 'small', sub: copy.rowsSub2 },
            { label: copy.rowsLabel3, value: copy.rowsValue2, cls: 'small', sub: copy.rowsSub3 },
            { label: copy.rowsLabel4, value: copy.rowsValue3, cls: 'small', sub: copy.rowsSub4 },
            { label: copy.rowsLabel5, value: '—', cls: 'small' },
            { label: copy.rowsLabel6, value: copy.rowsValue4, cls: 'sum' },
            {
              label: copy.rowsLabel7,
              value: format(copy.rowsValue5, { stdPrice: n(std.price) }),
              cls: 'net',
            },
          ]}
        />
        <Note heading={copy.heading5}>
          <p>
            {copy.p6}
            <a href={href('spec')}>{copy.a}</a>
            {copy.p7}
          </p>
        </Note>
        <Note heading={copy.heading6} kind="warn">
          <p>
            {copy.p8}
            <strong>{copy.strong6}</strong>
            {copy.p9}
          </p>
          <p>
            {copy.p10}
            <strong>{copy.strong7}</strong>
            {copy.p11}
          </p>
        </Note>
      </Section>

      <Section eyebrow={copy.eyebrow4} heading={copy.heading7}>
        <Table
          headers={[
            copy.headers3,
            copy.headers4,
            copy.headers5,
            format(copy.headers6, { pINSTALLMENTCOUNT: P.INSTALLMENT_COUNT }),
            copy.headers7,
          ]}
          rows={P.BUILD.map((p) => {
            const ins = P.INSTALLMENT[p.key];
            const [tot] = P.totalInstallment(p.key);
            return [
              format(copy.rows7, { pName: p.name, pPages: p.pages, pWeeks: p.weeks }),
              n(p.price),
              n(ins.initial),
              n(ins.monthly),
              format(copy.rows8, { tot: n(tot) }),
            ];
          })}
          caption={copy.caption2}
          foot={format(copy.foot2, { pINSTALLMENTCOUNT: P.INSTALLMENT_COUNT })}
        />
        <Table
          headers={[copy.headers8, copy.headers9]}
          rows={[
            [
              copy.rows9,
              format(copy.rows10, {
                basicPrice: n(basic.price),
                pSINGLEPrice: n(P.SINGLE.price),
                basicPricePSINGLEPrice: n(basic.price - P.SINGLE.price),
              }),
            ],
            [copy.rows11, format(copy.rows12, { stdPriceBasicPrice: n(std.price - basic.price) })],
            [copy.rows13, format(copy.rows14, { pOPTIONS0Price: n(P.OPTIONS[0].price) })],
          ]}
          caption={copy.caption3}
          foot={copy.foot3}
        />
        <Note heading={copy.heading8} kind="good">
          <p>{copy.p12}</p>
          <p>
            {copy.p13}
            <strong>{copy.strong8}</strong>
          </p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow={copy.eyebrow5} heading={copy.heading9} lede={copy.lede4}>
        <div className="plans">
          {P.RUN.map((r) => {
            const pick = 'recommended' in r && r.recommended;
            return (
              <div className={`plan${pick ? ' pick' : ''}`} key={r.name}>
                {pick && <span className="tag">{copy.tag}</span>}
                <div className="pn">{r.name}</div>
                <div className="pmeta">{format(copy.pmeta, { pRUNTERM: P.RUN_TERM })}</div>
                <div className="pv">
                  <span className="amt tnum">
                    {n(r.price)}
                    <span className="u">{copy.u}</span>
                  </span>
                </div>
                <div className="why">{r.lede}</div>
                <ul>
                  {r.includes.map((i, k) => (
                    <li key={k}>{i}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <Note heading={copy.heading10}>
          <p>
            {copy.p14}
            <strong>{copy.strong9}</strong>
            {copy.p15}
          </p>
        </Note>
      </Section>

      <Section tone="dark" eyebrow={copy.eyebrow6} heading={copy.heading11} lede={copy.lede5}>
        <Figure
          svg={D.afterTwoYears(
            29_800,
            P.INSTALLMENT.standard.initial,
            P.INSTALLMENT.standard.monthly + P.run('run_standard').price,
          )}
        />
        <Table
          headers={[copy.headers10, copy.headers11, copy.headers12]}
          rows={[
            [copy.rows15, copy.rows16, copy.rows17],
            [copy.rows18, copy.rows19, copy.rows20],
            [copy.rows21, copy.rows22, copy.rows23],
            [
              copy.rows24,
              format(copy.rows25, { rivalTotal649800: n(rivalTotal - 649_800) }),
              format(copy.rows26, { stdPrice: n(std.price) }),
            ],
          ]}
        />
        <Note heading={copy.heading12} kind="bad">
          <p>
            {copy.p16}
            <strong>{copy.strong10}</strong>
          </p>
          <p>
            {copy.p17}
            <strong>{copy.strong11}</strong>
          </p>
        </Note>
      </Section>

      <Section eyebrow={copy.eyebrow7} heading={copy.heading13}>
        <Table
          headers={[copy.headers13, copy.headers14]}
          rows={P.FREE_ITEMS.map((f) => [
            `<strong>${f.name}</strong>`,
            `<span class="dim">${f.market}</span>`,
          ])}
        />
        <Table
          headers={[copy.headers15, copy.headers16, copy.headers17]}
          rows={P.OPTIONS.map((o) => [o.name, n(o.price), o.note])}
          caption={copy.caption4}
        />
      </Section>

      <Section tone="tint" heading={copy.a}>
        <Note heading={copy.heading14} kind="bad">
          <ul className="plain">
            {NOT_SELLING.map(([nm, r]) => (
              <li key={nm}>
                <strong>{nm}</strong>
                <br />
                {r}
              </li>
            ))}
          </ul>
          <p>
            {copy.p18}
            <a href={href('spec')}>{copy.a2}</a>
            {copy.p19}
          </p>
        </Note>
        <div className="btns">
          <PhoneLink className="btn btn-1" />
          <a className="btn btn-2" href={href('contact')}>
            {copy.btn2}
          </a>
        </div>
      </Section>
    </Base>
  );
}
