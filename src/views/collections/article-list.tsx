import * as C from '@/content/config';
import type { CollectionPageProps } from '@/content/page-props';
import { format } from '@/i18n/format';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import EntryDates from '@/components/collections/EntryDates';
import EntryImage from '@/components/collections/EntryImage';

export default function ArticleListPage({ file, og, copy, data }: CollectionPageProps<'articleList'>) {
  const text = copy.articles;
  const lead = data.entries.findIndex((entry) => entry.image);
  return (
    <Base
      file={file}
      og={og}
      title={format(copy.titleFormat, { title: text.title, brand: C.BRAND_T })}
      desc={text.description}
    >
      <Section eyebrow={text.eyebrow} heading={text.heading} h1 lede={text.lede} />
      <Section>
        <ul className="entry-list" aria-label={text.list}>
          {data.entries.map((entry, index) => (
            <li className="entry-card" key={entry.slug}>
              {entry.image && <EntryImage image={entry.image} priority={index === lead} />}
              <p className="entry-kind">
                <span>{text.kinds[entry.kind]}</span>
              </p>
              <h2 className="entry-title">
                <a href={entry.path}>{entry.title}</a>
              </h2>
              <EntryDates copy={copy} entry={entry} />
              <p className="entry-summary">{entry.seo.description}</p>
            </li>
          ))}
        </ul>
      </Section>
    </Base>
  );
}
