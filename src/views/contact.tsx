import Icon from '@/components/Icon';
import { ROUTES } from '@/routing/registry';
import PhoneLink from '@/components/PhoneLink';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import { INDUSTRIES } from '@/content/nav';
import { INQUIRY_FIELDS } from '@/content/inquiry';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Note from '@/components/Note';
import type { PageProps } from '@/content/page-props';

export default function ContactPage({ copy, route }: PageProps<'contact'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = format(copy.desc, {
    cRESPONSEPROMISE: C.RESPONSE_PROMISE,
    cTEL: C.TEL,
    cTELHOURS: C.TEL_HOURS,
  });
  const disabled = !C.FORM_ENDPOINT;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section
        eyebrow={copy.eyebrow}
        heading={copy.heading}
        h1
        navKey={file}
        lede={format(copy.lede, { cRESPONSEPROMISE: C.RESPONSE_PROMISE })}
      >
        <div className="contact-channels">
          <div className="contact-channel contact-channel-email">
            <h2>
              <Icon name="mail" />
              {copy.h32}
            </h2>
            <p className="contact-hours">{C.EMAIL_HOURS}</p>
            <a className="contact-email" href={C.EMAIL_LINK}>
              <span>
                {C.EMAIL.split('@')[0]}
                <wbr />
                {`@${C.EMAIL.split('@')[1]}`}
              </span>
              <Icon name="arrow-up-right" sm />
            </a>
            <p>{copy.emailHelp}</p>
          </div>
          <div className="contact-channel">
            <h2 className="sr-only">{copy.h3}</h2>
            <PhoneLink className="contact-phone" />
            <p className="contact-hours">{format(copy.p2, { cTELHOURS: C.TEL_HOURS })}</p>
            {C.LINE_URL && (
              <a className="btn btn-2" href={C.LINE_URL}>
                {copy.btn}
              </a>
            )}
          </div>
        </div>
      </Section>

      <Section heading={copy.consultationHeading} className="contact-preparation">
        <p>
          {copy.p}
          <strong>{copy.strong}</strong>
        </p>
        <ol className="steps">
          <li>
            <b>
              <Icon name="globe" />
              {copy.b}
            </b>
            <div className="d">{copy.d}</div>
          </li>
          <li>
            <b>
              <Icon name="receipt" />
              {copy.b2}
            </b>
            <div className="d">{copy.d2}</div>
          </li>
          <li>
            <b>
              <Icon name="message-circle" />
              {copy.b3}
            </b>
            <div className="d">{copy.d3}</div>
          </li>
        </ol>
      </Section>

      {C.CONTACT_METHOD === 'form' && (
        <Section className="contact-form" heading={copy.heading3}>
          {disabled && (
            <Note heading={copy.heading4} kind="warn">
              <p>{copy.p3}</p>
            </Note>
          )}
          <form action={C.FORM_ENDPOINT || undefined} method={C.FORM_ENDPOINT ? 'post' : undefined}>
            <div className="field">
              <label htmlFor="f-name">
                {copy.label}
                <span className="req">{copy.req}</span>
              </label>
              <input type="text" id="f-name" name="name" required autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="f-biz">{copy.label2}</label>
              <input type="text" id="f-biz" name="business" autoComplete="organization" />
            </div>
            <div className="field">
              <label htmlFor="f-ind">{copy.label3}</label>
              <select id="f-ind" name="industry">
                <option>{copy.option}</option>
                {INDUSTRIES.map(([u, n]) => (
                  <option key={u}>{n}</option>
                ))}
                <option>{copy.option2}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-tel">
                {copy.label4}
                <span className="req">{copy.req}</span>
              </label>
              <input type="tel" id="f-tel" name="tel" required autoComplete="tel" inputMode="tel" />
              <p className="hint">{copy.hint}</p>
            </div>
            <div className="field">
              <label htmlFor="f-mail">{copy.label5}</label>
              <input type="email" id="f-mail" name="email" autoComplete="email" inputMode="email" />
            </div>
            <div className="field">
              <label htmlFor="f-msg">
                {copy.label6}
                <span className="req">{copy.req}</span>
              </label>
              <textarea id="f-msg" name="message" required></textarea>
              <p className="hint">{copy.hint2}</p>
            </div>
            {!disabled && (
              // 迷惑投稿対策。hidden で表示・読み上げ・タブ移動から外し、値が入っていれば受付側で隔離する（ADR 0032）
              <div hidden>
                <label htmlFor="f-hp">{copy.honeypotLabel}</label>
                <input
                  type="text"
                  id="f-hp"
                  name={INQUIRY_FIELDS.honeypot}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
            )}
            {disabled ? (
              <button className="btn btn-1" type="submit" disabled>
                {copy.btn2}
              </button>
            ) : (
              <button className="btn btn-1" type="submit">
                {copy.btn3}
              </button>
            )}
          </form>
          <p className="dim">{copy.dim}</p>
        </Section>
      )}
    </Base>
  );
}
