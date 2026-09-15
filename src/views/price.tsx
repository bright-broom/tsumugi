import { OwnershipClock } from '@/components/diagrams/OwnershipClock';
import { ROUTES, href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Entry from '@/components/Entry';
import Plans from '@/components/Plans';
import type { PageProps } from '@/content/page-props';

export default function PricePage({ copy, route }: PageProps<'price'>) {
  const n = (v: number) => v.toLocaleString('en-US');
  const rows = P.compareRows();
  const one = rows[0]!;
  const updatedTotal = P.oursTotal(P.build('basic').price, 'run_basic');
  return (
    <Base
      file={ROUTES[route].file}
      title={format(copy.title, { single: n(P.SINGLE.price), brand: C.BRAND_T })}
      desc={copy.desc}
    >
      <Section
        eyebrow={copy.eyebrow}
        heading={copy.heading}
        lede={copy.lede}
        h1
        navKey={ROUTES[route].file}
      >
        <Note heading={copy.preparationTitle} kind="warn">
          <p>{copy.availability}</p>
        </Note>
        <Entry full />
        <h3 className="pricing-subheading">{copy.production}</h3>
        <Plans />
        <p>{copy.deliveryNote}</p>
      </Section>
      <Section tone="tint" heading={copy.supportTitle} lede={copy.supportLede}>
        <div className="cq">
          <div className="plans support-plans">
            {P.RUN.map((r) => (
              <div className="plan" key={r.key}>
                <div className="pn">{r.name}</div>
                <div className="pv">
                  <span className="amt tnum">
                    {n(r.price)}
                    <span className="u">{copy.monthly}</span>
                  </span>
                </div>
                <div className="why">{r.lede}</div>
                <ul>
                  {r.includes.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <Note heading={copy.scopeTitle}>
          <p>{copy.scope}</p>
          <a className="btn btn-2" href={href('unlimited')}>
            {copy.scopeLink}
          </a>
        </Note>
        <Note heading={copy.externalTitle}>
          <p>{copy.external}</p>
        </Note>
      </Section>
      <Section heading={copy.paymentTitle}>
        <Table
          headers={[...copy.paymentHeaders]}
          rows={P.productionPlans().map((p) => {
            const s = P.paymentSchedule(p.price);
            return [p.name, P.yen(p.price), P.yen(s.deposit), P.yen(s.acceptance)];
          })}
          caption={copy.paymentNote}
        />
        <h3>{copy.upgradeTitle}</h3>
        <Table
          headers={[...copy.upgradeHeaders]}
          rows={[
            [copy.upgrade1, P.yen(P.build('basic').price - P.SINGLE.price)],
            [copy.upgrade2, P.yen(P.build('standard').price - P.build('basic').price)],
          ]}
          caption={copy.upgradeNote}
        />
        <a className="btn btn-2" href={href('terms')}>
          {copy.termsLink}
        </a>
      </Section>
      <Section
        tone="tint"
        heading={copy.comparisonTitle}
        lede={format(copy.comparisonLede, { months: P.COMPARE_MONTHS })}
      >
        <OwnershipClock
          subMonthly={one.sub_monthly}
          subTotal={one.sub_total}
          ourPrice={one.our_price}
          months={P.COMPARE_MONTHS}
        />
        <Table
          headers={[...copy.comparisonHeaders]}
          rows={rows.map((r) => [
            format(copy.comparisonPages, { ours: r.our_pages, theirs: r.sub_pages }),
            format(copy.comparisonOther, {
              initial: n(P.SUBS_MARKET[0].init),
              monthly: n(r.sub_monthly),
              total: n(r.sub_total),
            }),
            format(copy.comparison.ours, {
              price: n(r.our_price),
              total: n(r.our_total),
            }) +
              '<br>' +
              format(r.diff < 0 ? copy.cheaper : copy.dearer, { diff: n(Math.abs(r.diff)) }),
          ])}
          caption={format(copy.comparisonNote, {
            source: P.SUBS_SOURCE,
          })}
        />
        <p className="fine-note">
          {format(copy.comparison.assumptions, {
            care: n(P.run('run_light').price),
            external: n(P.EXTERNAL_MONTHLY_ESTIMATE),
          })}
        </p>
        <Note heading={copy.comparisonDetailTitle}>
          <p>
            {format(copy.comparisonDetail, {
              total: n(updatedTotal),
              diff: n(updatedTotal - rows[1]!.sub_total),
            })}
          </p>
        </Note>
      </Section>
      <Section heading={copy.optionsTitle}>
        <Table
          headers={[...copy.includedHeaders]}
          rows={P.FREE_ITEMS.map((f) => [f.name, f.market])}
        />
        <Table
          headers={[...copy.optionHeaders]}
          rows={P.OPTIONS.map((o) => [o.name, P.yen(o.price), o.note])}
          caption={copy.optionNote}
        />
      </Section>
    </Base>
  );
}
