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
import FaqList from '@/components/FaqList';
import Cards from '@/components/Cards';
import Calc from '@/components/Calc';
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
  const mStd = P.run('run_basic').price;
  const tabelogBasic = 27_500;
  const cmp = P.compareRows();
  const one = cmp[0]!;

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
      <div className="home-content">
        <section className="hero home-intro">
          <div className="wrap">
            <div className="home-intro-copy">
              <p className="kick">
                <Icon name="globe" sm />
                {copy.kick}
              </p>
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
              <div className="btns">
                <PhoneLink className="btn btn-1" />
                <a className="btn btn-2" href={href('owned')}>
                  {copy.btn2}
                </a>
              </div>
            </div>
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
          </div>
        </section>

        <nav className="home-index" aria-label={copy.navigation.label}>
          <div className="wrap">
            <a href={href('index', 'ownership')}>
              <Icon name="key" />
              <span>{copy.navigation.ownership}</span>
              <Icon name="arrow-right" sm />
            </a>
            <a href={href('index', 'pricing')}>
              <Icon name="calculator" />
              <span>{copy.navigation.pricing}</span>
              <Icon name="arrow-right" sm />
            </a>
            <a href={href('index', 'industries')}>
              <Icon name="building-2" />
              <span>{copy.navigation.industries}</span>
              <Icon name="arrow-right" sm />
            </a>
            <a href={href('index', 'consultation')}>
              <Icon name="message-circle" />
              <span>{copy.navigation.contact}</span>
              <Icon name="arrow-right" sm />
            </a>
          </div>
        </nav>

        {/* 主張の中心。ここを読まずに帰る人がいないよう、金額の話より前に置く */}
        <Section
          id="ownership"
          className="home-section home-ownership"
          tone="tint"
          navKey={href('owned')}
          eyebrow={copy.eyebrow}
          heading={copy.heading}
          lede={copy.lede}
        >
          <Figure svg={D.landVsOwn()} />
          <Cards cls="g2" items={copy.ownership} />
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
          className="home-section home-cost"
          eyebrow={copy.eyebrow2}
          heading={copy.heading3}
          lede={copy.lede2}
        >
          <Vs
            max={55_000}
            rows={[
              { name: copy.rowsName, sub: copy.rowsSub, amount: 55_000 },
              { name: copy.rowsName2, sub: copy.rowsSub, amount: 27_500 },
              {
                name: copy.rowsName3,
                sub: copy.rowsSub2,
                amount: P.withTax(P.supportMonthlyTotal('run_basic')),
                ours: true,
              },
              { name: copy.rowsName4, sub: copy.rowsSub3, amount: 11_000 },
            ]}
          />
          <Figure
            svg={D.rentVsOwn(
              tabelogBasic,
              P.PORTAL_FEE_DINNER,
              P.withTax(P.supportMonthlyTotal('run_basic')),
            )}
          />
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
          className="home-section home-updates"
          eyebrow={copy.eyebrow3}
          heading={copy.heading5}
          lede={copy.lede3}
        >
          <div className="home-pair">
            <Calc
              title={copy.title2}
              rows={[
                { icon: 'pen-line', label: copy.rowsLabel, value: copy.rowsValue, cls: 'small' },
                { icon: 'image', label: copy.rowsLabel2, value: copy.rowsValue2, cls: 'small' },
                {
                  icon: 'calendar-off',
                  label: copy.rowsLabel3,
                  value: copy.rowsValue,
                  cls: 'small',
                },
                { icon: 'user-plus', label: copy.rowsLabel4, value: copy.rowsValue, cls: 'small' },
                { icon: 'clock', label: copy.rowsLabel5, value: copy.rowsValue, cls: 'small' },
                {
                  label: copy.rowsLabel6,
                  value: copy.rowsValue3,
                  cls: 'sum',
                },
                { label: copy.rowsLabel7, value: copy.rowsValue4, cls: 'net', sub: copy.rowsSub4 },
              ]}
            />
            <div className="home-aside">
              <Note heading={copy.heading6} kind="good">
                <p>{copy.p4}</p>
              </Note>
              <div className="btns">
                <a className="btn btn-2" href={href('unlimited')}>
                  {copy.btn5}
                </a>
              </div>
            </div>
          </div>
        </Section>

        <Section
          className="home-section home-promises"
          tone="dark"
          eyebrow={copy.eyebrow4}
          heading={copy.heading7}
        >
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
          className="home-section home-pricing"
          id="pricing"
          eyebrow={copy.eyebrow5}
          heading={format(copy.heading8, {
            singlePrice: n(P.SINGLE.price),
            standardPrice: n(std.price),
          })}
          lede={copy.lede4}
        >
          <Entry />
          <h3 className="home-pricing-subheading">{copy.h3}</h3>
          <Plans feat={3} />
          <p className="dim fine-note">
            {copy.dim2}
            <a href={href('price')}>{copy.a}</a>
          </p>
        </Section>

        <Section
          tone="dark"
          navKey={href('price')}
          className="home-section home-included"
          eyebrow={copy.eyebrow6}
          heading={copy.heading9}
          lede={copy.lede5}
        >
          <div className="home-pair">
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
            <div className="home-aside">
              <Note heading={copy.heading10}>
                <p>
                  {copy.p5}
                  <a href={href('price')}>{copy.a2}</a>
                  {copy.p6}
                  <a href={href('spec')}>{copy.a3}</a>
                </p>
              </Note>
            </div>
          </div>
        </Section>

        {/* 相手の土俵（月いくら）から、こちらの土俵（総額と所有）へ移す */}
        <Section
          tone="dark"
          navKey={href('price')}
          className="home-section home-comparison"
          eyebrow={copy.eyebrow7}
          heading={copy.heading11}
          lede={format(copy.lede6, { pCOMPAREMONTHS: P.COMPARE_MONTHS })}
        >
          <Figure
            svg={D.ownershipClock(
              one.sub_monthly,
              one.sub_total,
              one.our_price,
              one.our_run + one.our_external,
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
                value: format(copy.rowsValue8, { ourTotal: n(one.our_total) }),
                cls: 'sum',
                sub: copy.rowsSub7,
              },
              {
                label: copy.rowsLabel13,
                value: format(copy.rowsValue9, {
                  difference: n(one.diff),
                }),
                cls: 'net',
                sub: copy.rowsSub8,
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
                external: n(r.our_external),
              }) + copy.rows5,
            ])}
            foot={format(copy.foot, {
              pSUBSSOURCE: P.SUBS_SOURCE,
            })}
          />
          <Note heading={copy.heading12} kind="good">
            <p>
              {format(copy.p7, { pCOMPAREMONTHS: P.COMPARE_MONTHS })}
              <strong>
                {format(copy.strong5, {
                  difference: n(one.diff),
                })}
              </strong>
              {copy.p8}
            </p>
            <p>
              {copy.p9}
              <strong>{copy.strong6}</strong>
              {copy.p10}
            </p>
          </Note>
        </Section>

        <Section
          navKey={href('subsidy')}
          className="home-section home-subsidy"
          eyebrow={copy.eyebrow8}
          heading={copy.heading13}
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

        <Section
          id="industries"
          className="home-section home-industries"
          tone="tint"
          eyebrow={copy.eyebrow9}
          heading={copy.heading15}
          lede={copy.lede8}
        >
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
          navKey={href('faq')}
          className="home-section home-faq"
          eyebrow={copy.eyebrow10}
          heading={copy.heading16}
          lede={copy.lede9}
        >
          <FaqList entries={copy.questions} />
        </Section>

        <Section
          tone="dark"
          id="consultation"
          className="home-section home-contact"
          heading={copy.heading17}
          lede={format(copy.lede10, { cRESPONSEPROMISE: C.RESPONSE_PROMISE })}
        >
          <ul className="consultation-topics">
            {(
              [
                { icon: 'receipt', label: copy.itemsLabel },
                { icon: 'percent', label: copy.itemsLabel2 },
                { icon: 'users', label: copy.itemsLabel3 },
                { icon: 'calculator', label: copy.itemsLabel4 },
              ] as const
            ).map((item) => (
              <li key={item.label}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="home-followup">
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
      </div>
    </Base>
  );
}
