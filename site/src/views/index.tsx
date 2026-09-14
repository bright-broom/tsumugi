import { pathForFile } from '@/routing/registry';
import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import PhoneLink from '@/components/PhoneLink';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import * as D from '@/content/diagrams';
import { INDUSTRIES, IND_IC } from '@/content/nav';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Acc from '@/components/Acc';
import Cards from '@/components/Cards';
import Calc from '@/components/Calc';
import Stats from '@/components/Stats';
import Vs from '@/components/Vs';
import Entry from '@/components/Entry';
import Plans from '@/components/Plans';
import Figure from '@/components/Figure';
import Icon from '@/components/Icon';
import type { PageProps } from '@/content/page-props';
import { HOME_HERO } from '@/content/hero';

export default function IndexPage({ copy, route }: PageProps<'home'>) {
  const file = ROUTES[route].file;
  const n = (v: number) => v.toLocaleString('en-US');
  const sd = P.subsidyCalc();
  const std = P.build('standard');
  const mStd = P.monthlyAllIn('standard', 'run_standard');
  const tabelogBasic = 27_500;
  const cmp = P.compareRows();
  const one = cmp[0]!;
  const big = cmp[2]!;
  const totalSpot = 3_000 + 5_000 * 3 + 3_000 + 3_000 + 3_000;
  const title = format(copy.title, { pSINGLEPrice: n(P.SINGLE.price), cBRANDT: C.BRAND_T });
  const desc = format(copy.desc, { pSINGLEPrice: n(P.SINGLE.price) }) + copy.desc2;

  return (
    <Base file={file} title={title} desc={desc}>
      <section className="brand-hero" aria-labelledby="brand-heading">
        <img
          className="brand-hero-artwork"
          src={HOME_HERO.src}
          width={HOME_HERO.width}
          height={HOME_HERO.height}
          alt={copy.hero.artworkAlt}
          fetchPriority="high"
          loading="eager"
        />
        <div className="brand-hero-copy">
          <h1 id="brand-heading">
            {copy.hero.heading}
            <br />
            {copy.hero.heading2}
          </h1>
          <p>
            {copy.hero.message}
            <br />
            {copy.hero.message2}
          </p>
        </div>
      </section>
      {/* ブランド画像に続けて、所有・価格・問い合わせの具体的な案内を置く。 */}
      <section className="hero">
        <div className="wrap">
          <p className="kick">{copy.kick}</p>
          <h2 className="service-intro-title">
            {copy.h1}
            <br />
            {copy.h12}
          </h2>
          <p className="sub">
            {copy.sub}
            <strong>{copy.strong}</strong>
            {copy.sub2}
            <br />
            {copy.sub3}
            <strong>{copy.strong2}</strong>
            {copy.sub4}
          </p>
          <div className="pricebox">
            <span className="amtwrap">
              <span className="pre">{copy.pre}</span>
              <span className="amt tnum">
                {n(P.SINGLE.price)}
                <span className="u">{copy.u}</span>
              </span>
            </span>
            <ul className="alt">
              <li>
                <b>{copy.b}</b>
                {copy.li}
              </li>
              <li>
                {format(copy.li2, { pRunRunLightPrice: n(P.run('run_light').price) })}
                <b>{copy.b2}</b>
              </li>
              <li>{format(copy.li3, { stdPrice: n(std.price), mStd: n(mStd) })}</li>
            </ul>
          </div>
          <div className="btns">
            <PhoneLink className="btn btn-1" />
            <a className="btn btn-2" href={href('owned')}>
              {copy.btn2}
            </a>
          </div>
        </div>
      </section>

      {/* 主張の中心。ここを読まずに帰る人がいないよう、金額の話より前に置く */}
      <Section
        tone="tint"
        navKey={href('owned')}
        eyebrow={copy.eyebrow}
        heading={copy.heading}
        lede={copy.lede}
      >
        <Figure svg={D.landVsOwn()} />
        <Cards
          cls="g2"
          items={[
            { title: copy.itemsTitle, desc: copy.itemsDesc, link: [copy.itemsLink, href('terms')] },
            {
              title: copy.itemsTitle2,
              desc: copy.itemsDesc2,
              link: [copy.itemsLink2, href('source')],
            },
            {
              title: copy.itemsTitle3,
              desc: copy.itemsDesc3,
              link: [copy.itemsLink3, href('spec')],
            },
            {
              title: copy.itemsTitle4,
              desc: copy.itemsDesc4,
              link: [copy.itemsLink4, href('terms')],
            },
          ]}
        />
        <Note heading={copy.heading2}>
          <p>
            {copy.p}
            <strong>{copy.strong3}</strong>
            {copy.p2}
          </p>
        </Note>
        <div className="btns">
          <a className="btn btn-2" href={href('owned')}>
            {copy.btn3}
          </a>
        </div>
      </Section>

      <Section
        navKey={href('cost-cut')}
        eyebrow={copy.eyebrow2}
        heading={copy.heading3}
        lede={copy.lede2}
      >
        <Vs
          max={55_000}
          rows={[
            { name: copy.rowsName, sub: copy.rowsSub, amount: 55_000 },
            { name: copy.rowsName2, sub: copy.rowsSub, amount: 27_500 },
            { name: copy.rowsName3, sub: copy.rowsSub2, amount: mStd, ours: true },
            { name: copy.rowsName4, sub: copy.rowsSub3, amount: 11_000 },
          ]}
        />
        <Figure svg={D.rentVsOwn(tabelogBasic, P.PORTAL_FEE_DINNER, P.run('run_standard').price)} />
        <Note heading={copy.heading4} kind="good">
          <p>
            {format(copy.p3, {
              pPORTALFEEDINNER: P.PORTAL_FEE_DINNER,
              pPORTALFEELUNCH: P.PORTAL_FEE_LUNCH,
            })}
            <strong>{copy.strong4}</strong>
          </p>
        </Note>
        <div className="btns">
          <a className="btn btn-2" href={href('cost-cut')}>
            {copy.btn4}
          </a>
        </div>
        <p className="dim fine-note">{copy.dim}</p>
      </Section>

      <Section
        navKey={href('unlimited')}
        eyebrow={copy.eyebrow3}
        heading={copy.heading5}
        lede={copy.lede3}
      >
        <Calc
          title={copy.title2}
          rows={[
            { label: copy.rowsLabel, value: copy.rowsValue, cls: 'small' },
            { label: copy.rowsLabel2, value: copy.rowsValue2, cls: 'small' },
            { label: copy.rowsLabel3, value: copy.rowsValue, cls: 'small' },
            { label: copy.rowsLabel4, value: copy.rowsValue, cls: 'small' },
            { label: copy.rowsLabel5, value: copy.rowsValue, cls: 'small' },
            {
              label: copy.rowsLabel6,
              value: format(copy.rowsValue3, { totalSpot: n(totalSpot) }),
              cls: 'sum',
            },
            { label: copy.rowsLabel7, value: copy.rowsValue4, cls: 'net', sub: copy.rowsSub4 },
          ]}
        />
        <Note heading={copy.heading6} kind="good">
          <p>{copy.p4}</p>
        </Note>
        <div className="btns">
          <a className="btn btn-2" href={href('unlimited')}>
            {copy.btn5}
          </a>
        </div>
      </Section>

      <Section tone="dark" eyebrow={copy.eyebrow4} heading={copy.heading7}>
        <Cards
          items={[
            {
              title: copy.itemsTitle5,
              desc: copy.itemsDesc5,
              link: [copy.itemsLink5, href('owned')],
            },
            {
              title: copy.itemsTitle6,
              desc: copy.itemsDesc6,
              link: [copy.itemsLink6, href('unlimited')],
            },
            {
              title: copy.itemsTitle7,
              desc: copy.itemsDesc7,
              link: [copy.itemsLink7, href('cost-cut')],
            },
          ]}
        />
      </Section>

      <Section
        navKey={href('price')}
        eyebrow={copy.eyebrow5}
        heading={copy.heading8}
        lede={copy.lede4}
      >
        <Entry />
        <h3 style={{ margin: '44px 0 18px' }}>{copy.h3}</h3>
        <Plans feat={3} />
        <p className="dim fine-note">
          {copy.dim2}
          <a href={href('price')}>{copy.a}</a>
        </p>
      </Section>

      <Section
        tone="tint"
        navKey={href('price')}
        eyebrow={copy.eyebrow6}
        heading={copy.heading9}
        lede={copy.lede5}
      >
        <Calc
          title={copy.title3}
          rows={[
            { label: copy.rowsLabel8, value: '', cls: 'small', sub: copy.rowsSub5 },
            { label: copy.rowsLabel9, value: copy.rowsValue5, cls: 'sum' },
            {
              label: copy.rowsLabel10,
              value: format(copy.rowsValue6, { stdPrice: n(std.price) }),
              cls: 'net',
            },
          ]}
        />
        <Note heading={copy.heading10}>
          <p>
            {copy.p5}
            <a href={href('price')}>{copy.a2}</a>
            {copy.p6}
            <a href={href('spec')}>{copy.a3}</a>
          </p>
        </Note>
      </Section>

      {/* 相手の土俵（月いくら）から、こちらの土俵（総額と所有）へ移す */}
      <Section
        tone="dark"
        navKey={href('price')}
        eyebrow={copy.eyebrow7}
        heading={copy.heading11}
        lede={format(copy.lede6, { pCOMPAREMONTHS: P.COMPARE_MONTHS })}
      >
        <Figure
          svg={D.ownershipClock(
            one.sub_monthly,
            one.sub_total,
            one.our_price,
            one.our_run,
            P.COMPARE_MONTHS,
          )}
        />
        <Calc
          title={format(copy.title4, { pCOMPAREMONTHS: P.COMPARE_MONTHS })}
          rows={[
            {
              label: format(copy.rowsLabel11, {
                oneSubMonthly: n(one.sub_monthly),
                pSUBSMARKET0Init: n(P.SUBS_MARKET[0].init),
              }),
              value: format(copy.rowsValue7, { oneSubTotal: n(one.sub_total) }),
              cls: 'small',
              sub: format(copy.rowsSub6, { pSUBSTRANSFERMONTHS: P.SUBS_TRANSFER_MONTHS }),
            },
            {
              label: format(copy.rowsLabel12, { cBRAND: C.BRAND }),
              value: format(copy.rowsValue8, { pSINGLEPrice: n(P.SINGLE.price) }),
              cls: 'sum',
              sub: copy.rowsSub7,
            },
            {
              label: copy.rowsLabel13,
              value: format(copy.rowsValue9, {
                oneSubTotalPSINGLEPrice: n(one.sub_total - P.SINGLE.price),
              }),
              cls: 'net',
              sub: format(copy.rowsSub8, {
                mathRoundPSingleVsSubsMonths: Math.round(P.singleVsSubsMonths()),
              }),
            },
          ]}
        />
        <Table
          headers={[copy.headers, copy.headers2, C.BRAND]}
          rows={cmp.map((r) => [
            format(copy.rows, { rSubPages: r.sub_pages }),
            format(copy.rows2, {
              rSubMonthly: n(r.sub_monthly),
              pCOMPAREMONTHS: P.COMPARE_MONTHS,
              rSubTotal: n(r.sub_total),
            }) + format(copy.rows3, { pSUBSTRANSFERMONTHS: P.SUBS_TRANSFER_MONTHS }),
            format(copy.rows4, {
              rOurPrice: n(r.our_price),
              rOurRun: n(r.our_run),
              rOurTotal: n(r.our_total),
            }) + copy.rows5,
          ])}
          foot={format(copy.foot, {
            pSUBSSOURCE: P.SUBS_SOURCE,
            bigSubPages: big.sub_pages,
            bigDiff: n(big.diff),
          })}
        />
        <Note heading={copy.heading12} kind="good">
          <p>
            {format(copy.p7, { bigSubPages: big.sub_pages, pCOMPAREMONTHS: P.COMPARE_MONTHS })}
            <strong>
              {format(copy.strong5, {
                bigDiff: n(big.diff),
                mathFloorBigDiffPCOMPAREMONTHS: n(Math.floor(big.diff / P.COMPARE_MONTHS)),
              })}
            </strong>
            {copy.p8}
          </p>
          <p>
            {copy.p9}
            <strong>{copy.strong6}</strong>
            {format(copy.p10, { pOPTIONS1Price: n(P.OPTIONS[1].price) })}
          </p>
        </Note>
      </Section>

      <Section
        navKey={href('subsidy')}
        eyebrow={copy.eyebrow8}
        heading={format(copy.heading13, { sdTotal: P.yen(sd.total), sdNet: P.yen(sd.net) })}
        lede={format(copy.lede7, { pSUBSIDYName: P.SUBSIDY.name, sdNet: P.yen(sd.net) })}
      >
        <Figure svg={D.subsidyBar(sd.total, sd.web, sd.pr, sd.grant, sd.net)} />
        <Note
          heading={format(copy.heading14, { pSUBSIDYAdoptionRate: P.SUBSIDY.adoption_rate })}
          kind="warn"
        >
          <p>
            {copy.p11}
            <strong>{copy.strong7}</strong>
          </p>
          <p>
            {format(copy.p12, {
              pSUBSIDYDeadline: P.SUBSIDY.deadline,
              pSUBSIDYForm4Deadline: P.SUBSIDY.form4_deadline,
            })}
            <a href={href('subsidy')}>{copy.a4}</a>
          </p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow={copy.eyebrow9} heading={copy.heading15} lede={copy.lede8}>
        <div className="cq">
          <div className="inds">
            {INDUSTRIES.map(([u, nm, dd]) => (
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

      <Section
        navKey={href('spec')}
        eyebrow={copy.eyebrow10}
        heading={copy.heading16}
        lede={copy.lede9}
      >
        <Acc summary={copy.summary}>
          <p>{copy.p13}</p>
        </Acc>
        <Acc summary={copy.summary2}>
          <p>{copy.p14}</p>
        </Acc>
        <Acc summary={copy.summary3}>
          <p>{copy.p15}</p>
        </Acc>
        <Acc summary={copy.summary4}>
          <p>{copy.p16}</p>
        </Acc>
        <Acc summary={copy.summary5}>
          <p>
            {copy.p17}
            <strong>{copy.strong8}</strong>
            {copy.p18}
          </p>
        </Acc>
      </Section>

      <Section
        tone="dark"
        heading={copy.heading17}
        lede={format(copy.lede10, { cRESPONSEPROMISE: C.RESPONSE_PROMISE })}
      >
        <Stats
          items={[
            { icon: 'receipt', value: '1', label: copy.itemsLabel },
            { icon: 'percent', value: '2', label: copy.itemsLabel2 },
            { icon: 'users', value: '3', label: copy.itemsLabel3 },
            { icon: 'calculator', value: '=', label: copy.itemsLabel4 },
          ]}
        />
        <p style={{ marginTop: '18px' }}>
          {copy.p19}
          <strong>{copy.strong9}</strong>
          {copy.p20}
        </p>
        <div className="btns">
          <PhoneLink className="btn btn-1" />
          <a className="btn btn-2" href={href('contact')}>
            {copy.btn6}
          </a>
        </div>
      </Section>
    </Base>
  );
}
