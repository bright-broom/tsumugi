import PageIndex from '@/components/PageIndex';
import { esc, raw } from '@/lib/raw';
import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Note from '@/components/Note';
import Cta from '@/components/Cta';
import { useMessages } from '@/components/ContentProvider';
import StaffList from '@/components/storefront/StaffList';
import StoreInfo from '@/components/storefront/StoreInfo';
import TestimonialList from '@/components/storefront/TestimonialList';
import type { PageProps } from '@/content/page-props';
import { STAFF } from '@/content/staff';
import { STORE, STORE_AS_OF } from '@/content/store';
import { TESTIMONIALS } from '@/content/testimonials';
import { publishedStaff } from '@/lib/storefront/staff';
import { publishableTestimonials } from '@/lib/storefront/testimonials';

export default function AboutPage({ copy, route }: PageProps<'about'>) {
  const storefront = useMessages('storefront');
  // 顧客テンプレートの欄は、公開できるデータがあるときだけ出す（紬はどれも空）。
  const staff = publishedStaff(STAFF);
  const voices = publishableTestimonials(TESTIMONIALS);
  const visitable = STORE.locations.some((location) => location.visit);
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
      >
        <PageIndex page="about" />
      </Section>

      <Section id="team" heading={C.TEAM_HEADING}>
        <p>{C.TEAM_INTRO}</p>
        {staff.length ? (
          <StaffList members={staff} />
        ) : (
          <div className="cards member-cards">
            {C.MEMBERS.map((m) => (
              <article className="card" key={m.role}>
                <h2 className="member-name">{m.name}</h2>
                <div className="meta">{m.role}</div>
                <div className="desc">{m.bio}</div>
              </article>
            ))}
          </div>
        )}
        <Note heading={copy.heading2}>
          <p>
            {copy.p}
            <strong>{copy.strong}</strong>
          </p>
        </Note>
      </Section>

      <Section
        id="response"
        tone="tint"
        eyebrow={copy.eyebrow2}
        heading={format(copy.heading3, { cRESPONSEPROMISE: C.RESPONSE_PROMISE })}
      >
        <p
          dangerouslySetInnerHTML={raw(format(copy.response, { promise: esc(C.RESPONSE_PROMISE) }))}
        />
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

      <Section id="principles" heading={copy.heading5}>
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

      {visitable && (
        <Section heading={storefront.store.heading}>
          <StoreInfo store={STORE} asOf={STORE_AS_OF} />
        </Section>
      )}

      {voices.length > 0 && (
        <Section heading={storefront.testimonials.heading}>
          <TestimonialList testimonials={voices} business={STORE.name} />
        </Section>
      )}

      <Section heading={copy.heading6}>
        <Cta />
      </Section>
    </Base>
  );
}
