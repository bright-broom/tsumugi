import * as C from '@/content/config';
import type { CollectionPageProps } from '@/content/page-props';
import { format } from '@/i18n/format';
import { esc } from '@/lib/raw';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Cta from '@/components/Cta';
import Blocks from '@/components/collections/Blocks';
import EntryImage from '@/components/collections/EntryImage';

export default function AreaPage({ file, og, listPath, copy, data }: CollectionPageProps<'area'>) {
  const { entry } = data;
  const text = copy.areas;
  const partial = entry.service === 'partial';
  return (
    <Base
      file={file}
      og={og}
      title={format(copy.titleFormat, { title: entry.seo.title || entry.title, brand: C.BRAND_T })}
      desc={entry.seo.description}
    >
      <Section eyebrow={entry.prefecture} heading={esc(entry.title)} h1>
        <dl className="entry-facts">
          <div>
            <dt>{text.status}</dt>
            <dd>
              {partial ? text.service.partial : text.service.available}
              {partial && <span className="metric-note">{entry.serviceNote}</span>}
            </dd>
          </div>
        </dl>
      </Section>
      <Section>
        <div className="entry-article">
          {entry.image && <EntryImage className="entry-hero" image={entry.image} priority />}
          <Blocks blocks={entry.body} priorityImage={!entry.image} />
          <p className="entry-back">
            <a className="more" href={listPath}>
              {copy.backToList}
            </a>
          </p>
        </div>
        <Cta primary={text.contact} />
      </Section>
    </Base>
  );
}
