import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Note from '@/components/Note';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function AboutPage({ copy, route }: PageProps<'about'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = format(copy.desc, { cRESPONSEPROMISE: C.RESPONSE_PROMISE });

  return (
    <Base file={file} title={title} desc={desc}>
      <Section
        eyebrow={copy.eyebrow}
        heading={copy.heading}
        h1
        navKey={file}
        lede={format(copy.lede, { cSERVICENOTE: C.SERVICE_NOTE })}
      />

      <Section>
        <div className="cards member-cards">
          {C.MEMBERS.map((m) => (
            <article className="card" key={m.role}>
              <h2 className="member-name">{m.name}</h2>
              <div className="meta">{m.role}</div>
              <div className="desc">{m.bio}</div>
            </article>
          ))}
        </div>
        <Note heading={copy.heading2}>
          <p>
            {copy.p}
            <strong>{copy.strong}</strong>
          </p>
        </Note>
      </Section>

      <Section
        tone="tint"
        eyebrow={copy.eyebrow2}
        heading={format(copy.heading3, { cRESPONSEPROMISE: C.RESPONSE_PROMISE })}
      >
        <p>
          {copy.p2}
          <strong>{C.RESPONSE_PROMISE}</strong>
          {copy.p3}
        </p>
        {C.RESPONSE_ACTUAL ? (
          <p>
            <strong>{format(copy.strong2, { cRESPONSEACTUAL: C.RESPONSE_ACTUAL })}</strong>
          </p>
        ) : (
          <p className="dim">{copy.dim}</p>
        )}
        <Note heading={copy.heading4}>
          <p>
            {copy.p4}
            <strong>{copy.strong3}</strong>
            {copy.p5}
          </p>
          <p>
            {copy.p6}
            <strong>{copy.strong4}</strong>
            {copy.p7}
          </p>
        </Note>
      </Section>

      <Section heading={copy.heading5}>
        <ul className="plain">
          <li>
            <strong>{copy.strong5}</strong>
            {copy.li}
          </li>
          <li>
            <strong>{copy.strong6}</strong>
            {copy.li2}
          </li>
          <li>
            <strong>{copy.strong7}</strong>
            <a href={href('spec')}>{copy.a}</a>
            {copy.li3}
          </li>
          <li>
            <strong>{copy.strong8}</strong>
            {copy.li4}
            <a href={href('owned')}>{copy.a2}</a>
            {copy.li5}
            <a href={href('source')}>{copy.a3}</a>
            {copy.li6}
          </li>
          <li>
            <strong>{copy.strong9}</strong>
            {copy.li7}
          </li>
        </ul>
      </Section>

      <Section heading={copy.heading6}>
        <Cta />
      </Section>
    </Base>
  );
}
