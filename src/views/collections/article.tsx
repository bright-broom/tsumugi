import * as C from '@/content/config';
import type { CollectionPageProps } from '@/content/page-props';
import { format } from '@/i18n/format';
import { esc } from '@/lib/raw';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Blocks from '@/components/collections/Blocks';
import EntryDates from '@/components/collections/EntryDates';
import EntryImage from '@/components/collections/EntryImage';

export default function ArticlePage({ file, og, listPath, copy, data }: CollectionPageProps<'article'>) {
  const { entry } = data;
  return (
    <Base
      file={file}
      og={og}
      title={format(copy.titleFormat, { title: entry.seo.title || entry.title, brand: C.BRAND_T })}
      desc={entry.seo.description}
    >
      <Section eyebrow={copy.articles.kinds[entry.kind]} heading={esc(entry.title)} h1>
        <EntryDates copy={copy} entry={entry} />
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
      </Section>
    </Base>
  );
}
