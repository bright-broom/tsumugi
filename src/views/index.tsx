import { LandVsOwn } from '@/components/diagrams/LandVsOwn';
import { RentVsOwn } from '@/components/diagrams/RentVsOwn';
import { OwnershipClock } from '@/components/diagrams/OwnershipClock';
import { SubsidyBar } from '@/components/diagrams/SubsidyBar';
import Acc from '@/components/Acc';
import type { IconName } from '@/lib/icons';
import { pathForFile } from '@/routing/registry';
import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import PhoneLink from '@/components/PhoneLink';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
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
  const scopeIcons: IconName[] = ['route', 'file-text', 'code-xml', 'pen-line', 'key'];
  const extraIcons: IconName[] = ['camera', 'globe', 'shield'];

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
          <LandVsOwn />
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
          <RentVsOwn
            portal={tabelogBasic}
            fee={P.PORTAL_FEE_DINNER}
            run={P.withTax(P.supportMonthlyTotal('run_basic'))}
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
          heading={copy.heading8}
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
        >
          <div className="pricing-scope">
            <div className="scope-included">
              <h3>{copy.scope.included}</h3>
              <ul>
                {copy.scope.items.map((item, i) => (
                  <li key={item}>
                    <Icon name={scopeIcons[i]!} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="scope-separate">
              <h3>
                <Icon name="receipt" />
                {copy.scope.separate}
              </h3>
              <ul>
                {copy.scope.extras.map((item, i) => (
                  <li key={item}>
                    <Icon name={extraIcons[i]!} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a className="more" href={href('spec')}>
                {copy.a3}
              </a>
            </div>
            <div className="scope-price">
              <div>
                <span className="scope-status">{copy.scope.preparing}</span>
                <h3>{copy.title3}</h3>
                <p>{copy.scope.note}</p>
              </div>
              <div>
                <strong className="tnum">
                  {format(copy.rowsValue6, { stdPrice: n(std.price) })}
                </strong>
                <span>{copy.scope.tax}</span>
              </div>
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
          lede={copy.lede6}
        >
          <div className="comparison-overview">
            <p className="comparison-period">
              <Icon name="calendar-days" sm />
              {format(copy.comparisonUi.total, { months: P.COMPARE_MONTHS })}
            </p>
            <div className="comparison-totals">
              <div>
                <h3>
                  <Icon name="repeat-2" />
                  {copy.comparisonUi.other}
                </h3>
                <strong className="tnum">{P.yen(one.sub_total)}</strong>
                <p>{format(copy.rowsSub6, { pSUBSTRANSFERMONTHS: P.SUBS_TRANSFER_MONTHS })}</p>
              </div>
              <div>
                <h3>
                  <Icon name="key" />
                  {copy.comparisonUi.ours}
                </h3>
                <strong className="tnum">{P.yen(one.our_total)}</strong>
                <p>{copy.rowsSub7}</p>
              </div>
            </div>
            <div className="comparison-difference">
              <Icon name="scale" />
              <div>
                <strong>{format(copy.comparisonUi.difference, { difference: n(one.diff) })}</strong>
                <p>{copy.rowsSub8}</p>
              </div>
            </div>
            <p className="comparison-assumptions">
              {format(copy.comparison.assumptions, {
                care: n(one.our_run),
                external: n(one.our_external),
              })}
            </p>
          </div>
          <OwnershipClock
            subMonthly={one.sub_monthly}
            subTotal={one.sub_total}
            ourPrice={one.our_price}
            months={P.COMPARE_MONTHS}
          />
          <Acc summary={copy.comparisonUi.detail}>
            <Table
              headers={[copy.headers, copy.headers2, C.BRAND]}
              rows={cmp.map((r) => [
                format(copy.rows, { rSubPages: r.sub_pages }),
                format(copy.rows2, {
                  rSubMonthly: n(r.sub_monthly),
                  pCOMPAREMONTHS: P.COMPARE_MONTHS,
                  rSubTotal: n(r.sub_total),
                }) + format(copy.rows3, { pSUBSTRANSFERMONTHS: P.SUBS_TRANSFER_MONTHS }),
                format(copy.comparison.ours, { price: n(r.our_price), total: n(r.our_total) }),
              ])}
              foot={format(copy.foot, {
                pSUBSSOURCE: P.SUBS_SOURCE,
              })}
            />
            <p>
              {copy.p9}
              <strong>{copy.strong6}</strong>
              {copy.p10}
            </p>
          </Acc>
        </Section>

        <Section
          navKey={href('subsidy')}
          className="home-section home-subsidy"
          eyebrow={copy.eyebrow8}
          heading={copy.heading13}
          lede={format(copy.lede7, { pSUBSIDYName: P.SUBSIDY.name, sdNet: P.yen(sd.net) })}
        >
          <SubsidyBar total={sd.total} web={sd.web} pr={sd.pr} grant={sd.grant} net={sd.net} />
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
