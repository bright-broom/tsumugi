import { ROUTES } from '@/routing/registry';
import PhoneLink from '@/components/PhoneLink';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import { INDUSTRIES } from '@/content/nav';
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
        <p>
          {copy.p}
          <strong>{copy.strong}</strong>
        </p>
        <ol className="steps">
          <li>
            <b>{copy.b}</b>
            <div className="d">{copy.d}</div>
          </li>
          <li>
            <b>{copy.b2}</b>
            <div className="d">{copy.d2}</div>
          </li>
          <li>
            <b>{copy.b3}</b>
            <div className="d">{copy.d3}</div>
          </li>
        </ol>
      </Section>

      <Section tone="tint" heading={copy.heading2}>
        <h3>{copy.h3}</h3>
        <p>
          <PhoneLink className="tel" />
        </p>
        <p>{format(copy.p2, { cTELHOURS: C.TEL_HOURS })}</p>
        {C.LINE_URL && (
          <p>
            <a className="btn btn-2" href={C.LINE_URL}>
              {copy.btn}
            </a>
          </p>
        )}
        <h3>{copy.h32}</h3>
        <p>
          <a href={`mailto:${C.EMAIL}`}>{C.EMAIL}</a>
        </p>
      </Section>

      <Section heading={copy.heading3}>
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
    </Base>
  );
}
