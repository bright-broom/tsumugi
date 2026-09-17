import { ActionLink } from '@/components/Action';
import type { ReactNode } from 'react';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Icon from '@/components/Icon';
import PageIndex from '@/components/PageIndex';
import Acc from '@/components/Acc';
import * as P from '@/content/prices';
import type { PageProps } from '@/content/page-props';
import type { IconName } from '@/lib/icons';
import { ROUTES, href } from '@/routing/registry';
import { format } from '@/i18n/format';

type Copy = PageProps<'catalog'>['copy'];
function Amount({
  value,
  copy,
  monthly = false,
  from = false,
}: {
  value: number;
  copy: Copy;
  monthly?: boolean;
  from?: boolean;
}) {
  return (
    <div className="catalog-price">
      <p>
        <strong className="tnum">{value.toLocaleString('en-US')}</strong>
        <span>
          {monthly
            ? from
              ? copy.yenMonthlyFrom
              : copy.yenMonthly
            : from
              ? copy.yenFrom
              : copy.yen}
        </span>
      </p>
      <small>
        {format(from ? copy.taxIncludedFrom : copy.taxIncluded, {
          amount: P.withTax(value).toLocaleString('en-US'),
        })}
      </small>
    </div>
  );
}
function Points({ children }: { children: readonly string[] }) {
  return (
    <ul className="catalog-points">
      {children.map((item) => (
        <li key={item}>
          <Icon name="check" sm />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
function Detail({ copy, children }: { copy: Copy; children: ReactNode }) {
  return (
    <div className="catalog-detail">
      <Acc summary={copy.scope}>{children}</Acc>
    </div>
  );
}

export default function CatalogPage({ copy, route }: PageProps<'catalog'>) {
  const production = [
    {
      plan: P.SINGLE,
      text: copy.production.single,
      icon: 'file-text',
      preparing: false,
      featured: false,
    },
    {
      plan: P.build('basic'),
      text: copy.production.basic,
      icon: 'building-2',
      preparing: P.build('basic').preparing,
      featured: true,
    },
    {
      plan: P.build('standard'),
      text: copy.production.standard,
      icon: 'pen-line',
      preparing: P.build('standard').preparing,
      featured: false,
    },
  ] as const;
  const custom = [
    { key: 'bespoke', icon: 'pen-line' },
    { key: 'feature', icon: 'code-xml' },
  ] as const;
  const supportIcons: Record<P.RunKey, IconName> = {
    run_self: 'key',
    run_light: 'shield',
    run_basic: 'pen-line',
    run_standard: 'target',
  };
  const supportRoles: Record<P.RunKey, string> = {
    run_self: copy.support.self,
    run_light: copy.support.care,
    run_basic: copy.support.update,
    run_standard: copy.support.improve,
  };
  const optionIcons = {
    page_add: 'file-text',
    photo_half_day: 'camera',
    photo_full_day: 'camera',
    logo: 'pen-line',
    article_interview: 'users',
    landing_page: 'target',
    booking_integration: 'calendar-days',
    language: 'globe',
  } as const;
  const payment = P.proposedFeaturePayment();
  const stages = ['file-text', 'pen-line', 'code-xml'] as const;
  const shared = ['receipt', 'key', 'code-xml'] as const;
  const costIcons = ['building-2', 'handshake', 'globe'] as const;

  return (
    <Base file={ROUTES[route].file} title={copy.title} desc={copy.desc}>
      <Section
        className="catalog-hero"
        h1
        eyebrow={copy.eyebrow}
        heading={copy.heading}
        lede={copy.lede}
      >
        <div className="catalog-hero-body">
          <div className="catalog-hero-action">
            <ActionLink variant="primary" href="#production">
              {copy.heroLink}
              <Icon name="arrow-down" sm />
            </ActionLink>
            <p>{copy.heroNote}</p>
          </div>
          <div className="catalog-stages">
            {copy.heroStages.map((stage, i) => (
              <a href={`#${stage.target}`} key={stage.title} className="catalog-stage">
                <Icon name={stages[i]!} />
                <strong>{stage.title}</strong>
                <span>{stage.detail}</span>
                <Icon name="arrow-down" sm />
              </a>
            ))}
          </div>
        </div>
        <ul className="catalog-principles">
          {copy.principles.map((item, i) => (
            <li key={item}>
              <Icon name={shared[i]!} sm />
              {item}
            </li>
          ))}
        </ul>
        <PageIndex page="catalog" />
      </Section>

      <Section
        id="production"
        className="catalog-production"
        eyebrow={copy.production.eyebrow}
        heading={copy.production.heading}
        lede={copy.production.lede}
      >
        <div className="catalog-production-grid">
          {production.map(({ plan, text, icon, preparing, featured }) => (
            <article
              key={plan.key}
              className={`catalog-product${featured ? ' catalog-featured' : ''}`}
              data-status={preparing ? 'preparing' : 'current'}
            >
              <div className="catalog-product-top">
                <Icon name={icon} />
                <span className="catalog-status">
                  {preparing ? copy.preparing : copy.available}
                </span>
              </div>
              <p className="catalog-role">{text.role}</p>
              <h3>{plan.name}</h3>
              <Amount value={plan.price} copy={copy} />
              <p className="catalog-description">{text.description}</p>
              <div className="catalog-specs">
                <span>
                  <Icon name="file-text" sm />
                  {format(copy.production.size, { pages: plan.pages })}
                </span>
                <span>
                  <Icon name="clock" sm />
                  {format(copy.production.weeks, { weeks: plan.weeks })}
                </span>
              </div>
              <Points>{text.points}</Points>
              <Detail copy={copy}>
                <Points>{plan.includes}</Points>
                {preparing && <p>{copy.production.cmsScope}</p>}
                <h4>{copy.excluded}</h4>
                {plan.key === 'single' ? (
                  <Points>{P.SINGLE.notIncludes}</Points>
                ) : (
                  <p>{preparing ? copy.production.cmsExclusion : copy.production.basicExclusion}</p>
                )}
              </Detail>
              {preparing ? (
                <p className="catalog-unavailable">
                  <Icon name="clock" sm />
                  {copy.preparing}
                </p>
              ) : (
                <ActionLink
                  variant={featured ? 'primary' : 'secondary'}
                  className="catalog-plan-cta"
                  href={href('contact')}
                >
                  {copy.consult}
                  <Icon name="arrow-right" sm />
                </ActionLink>
              )}
            </article>
          ))}
        </div>
        <p className="catalog-caption">
          <Icon name="circle-help" sm />
          {copy.production.availability}
        </p>
      </Section>

      <Section
        id="custom"
        className="catalog-custom"
        eyebrow={copy.custom.eyebrow}
        heading={copy.custom.heading}
        lede={copy.custom.lede}
      >
        <div className="catalog-custom-grid">
          {custom.map(({ key, icon }) => (
            <article
              key={key}
              className="catalog-custom-item"
              data-status={P.PROPOSED_PRICES[key].status}
            >
              <div className="catalog-product-top">
                <Icon name={icon} />
                <span className="catalog-status catalog-status-outline">{copy.concept}</span>
              </div>
              <p className="catalog-role">{copy.custom[key].role}</p>
              <h3>{copy.custom[key].title}</h3>
              <Amount copy={copy} value={P.PROPOSED_PRICES[key].price} from />
              <p>{copy.custom[key].description}</p>
              <Points>{copy.custom[key].points}</Points>
              <Detail copy={copy}>
                <p>{copy.custom[key].exclusion}</p>
              </Detail>
            </article>
          ))}
        </div>
        <aside className="catalog-discovery" data-status={P.PROPOSED_PRICES.discovery.status}>
          <div>
            <span className="catalog-status catalog-status-outline">{copy.concept}</span>
            <h3>
              <Icon name="route" />
              {copy.custom.discoveryTitle}
            </h3>
            <Amount copy={copy} value={P.PROPOSED_PRICES.discovery.price} />
          </div>
          <div>
            <p>{copy.custom.discoveryDetail}</p>
            <p>{copy.custom.discoveryCredit}</p>
            <p className="catalog-payment-label">
              {format(copy.custom.paymentExample, { total: payment.total.toLocaleString('en-US') })}
            </p>
            <ol className="catalog-payment">
              {[payment.design, payment.start, payment.acceptance].map((amount, i) => (
                <li key={copy.custom.paymentSteps[i]}>
                  <span>{copy.custom.paymentSteps[i]}</span>
                  <strong className="tnum">{P.yen(amount)}</strong>
                </li>
              ))}
            </ol>
            <p className="catalog-caption">{copy.custom.paymentNote}</p>
          </div>
        </aside>
        <div className="catalog-technology">
          <Icon name="code-xml" />
          <div>
            <h3>{copy.custom.technologyTitle}</h3>
            <p>{copy.custom.technology}</p>
          </div>
        </div>
      </Section>

      <Section
        id="support"
        className="catalog-support"
        eyebrow={copy.support.eyebrow}
        heading={copy.support.heading}
        lede={copy.support.lede}
      >
        <div className="catalog-support-grid">
          {P.RUN.map((plan) => (
            <article className="catalog-support-item" key={plan.key}>
              <Icon name={supportIcons[plan.key]} />
              <p className="catalog-role">{supportRoles[plan.key]}</p>
              <h3>{plan.name}</h3>
              <Amount copy={copy} value={plan.price} monthly />
              <p>{plan.lede}</p>
              <Points>{plan.includes}</Points>
            </article>
          ))}
        </div>
        <div className="catalog-support-rules">
          <div>
            <h3>{copy.support.rulesTitle}</h3>
            <p>{copy.support.rules}</p>
          </div>
          <ActionLink variant="secondary" href={href('unlimited')}>
            {copy.support.scopeLink}
            <Icon name="arrow-up-right" sm />
          </ActionLink>
        </div>
        <aside className="catalog-technical" data-status={P.PROPOSED_PRICES.technical.status}>
          <div>
            <span className="catalog-status catalog-status-outline">{copy.concept}</span>
            <h3>
              <Icon name="shield" />
              {copy.support.technicalTitle}
            </h3>
            <Amount copy={copy} value={P.PROPOSED_PRICES.technical.price} monthly from />
          </div>
          <div>
            <p>{copy.support.technical}</p>
            <p className="catalog-caption">{copy.support.technicalNote}</p>
          </div>
        </aside>
      </Section>

      <Section
        id="options"
        className="catalog-options"
        eyebrow={copy.options.eyebrow}
        heading={copy.options.heading}
        lede={copy.options.lede}
      >
        <div className="catalog-option-grid">
          {P.OPTIONS.map((option) => (
            <article className="catalog-option" key={option.key}>
              <Icon name={optionIcons[option.key]} />
              <div>
                <span className="catalog-option-kind">
                  {option.firm ? copy.options.fixed : copy.options.quoted}
                </span>
                <h3>{option.name}</h3>
                {option.note !== '—' && <p>{option.note}</p>}
              </div>
              <Amount copy={copy} value={option.price} />
            </article>
          ))}
        </div>
        <p className="catalog-caption">{copy.options.individual}</p>
      </Section>

      <Section
        id="total"
        className="catalog-total"
        eyebrow={copy.total.eyebrow}
        heading={copy.total.heading}
        lede={copy.total.lede}
      >
        <div className="catalog-cost-parts">
          {copy.total.parts.map((part, i) => (
            <div key={part.title}>
              <Icon name={costIcons[i]!} />
              <h3>{part.title}</h3>
              <p>{part.detail}</p>
            </div>
          ))}
        </div>
        <div
          className="catalog-table-scroll"
          tabIndex={0}
          role="region"
          aria-label={copy.total.caption}
        >
          <table className="catalog-table">
            <caption>{copy.total.caption}</caption>
            <thead>
              <tr>
                {copy.total.headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {P.catalogCostExamples().map((item, i) => (
                <tr key={item.key}>
                  <th scope="row">{copy.total.cases[i]}</th>
                  {[item.price, item.support, item.external, item.year, item.threeYears].map(
                    (amount, j) => (
                      <td className="tnum" key={j}>
                        {P.yen(amount)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="catalog-caption">
          {format(copy.total.assumptions, {
            external: P.EXTERNAL_MONTHLY_ESTIMATE.toLocaleString('en-US'),
            cms: P.CATALOG_COST_ASSUMPTIONS.cmsAdditionalMonthly.toLocaleString('en-US'),
            feature: P.CATALOG_COST_ASSUMPTIONS.featureExternalMonthly.toLocaleString('en-US'),
          })}
        </p>
        <p className="catalog-caption">{copy.total.note}</p>
        <ActionLink variant="secondary" href={href('price', 'domains')}>
          {copy.total.domainsLink}
          <Icon name="arrow-up-right" sm />
        </ActionLink>
      </Section>

      <Section
        id="conditions"
        className="catalog-conditions"
        eyebrow={copy.conditions.eyebrow}
        heading={copy.conditions.heading}
      >
        <div className="catalog-faq">
          {copy.conditions.questions.map((question) => (
            <Acc key={question.question} summary={question.question}>
              <p>{question.answer}</p>
            </Acc>
          ))}
        </div>
        <a className="more" href={href('terms')}>
          {copy.conditions.termsLink}
          <Icon name="arrow-right" sm />
        </a>
        <div className="catalog-contact">
          <div>
            <h3>{copy.conditions.contactTitle}</h3>
            <p>{copy.conditions.contactDetail}</p>
          </div>
          <ActionLink variant="primary" href={href('contact')}>
            {copy.conditions.contactLink}
            <Icon name="arrow-right" sm />
          </ActionLink>
        </div>
      </Section>
    </Base>
  );
}
