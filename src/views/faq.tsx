import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import FaqList from '@/components/FaqList';
import Icon from '@/components/Icon';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function FaqPage({ copy, route }: PageProps<'faq'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 navKey={file} lede={copy.lede}>
        <nav className="faq-index" aria-label={copy.indexLabel}>
          <ul>
            {copy.groups.map((group) => (
              <li key={group.id}>
                <a href={`#faq-group-${group.id}`}>
                  <Icon name={group.icon} sm />
                  <span>{group.title}</span>
                  <Icon name="arrow-right" sm />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Section>

      {copy.groups.map((group) => (
        <Section reading id={`faq-group-${group.id}`} heading={group.title} key={group.id}>
          <FaqList entries={group.entries} />
        </Section>
      ))}

      <Section
        tone="dark"
        heading={copy.heading2}
        lede={format(copy.lede2, { cRESPONSEPROMISE: C.RESPONSE_PROMISE })}
      >
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
