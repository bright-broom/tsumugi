import * as C from '@/content/config';
import type { CollectionPageProps } from '@/content/page-props';
import { format } from '@/i18n/format';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Cta from '@/components/Cta';

export default function AreaListPage({ file, og, copy, data }: CollectionPageProps<'areaList'>) {
  const text = copy.areas;
  const prefectures = new Map<string, typeof data.entries>();
  for (const entry of data.entries)
    prefectures.set(entry.prefecture, [...(prefectures.get(entry.prefecture) ?? []), entry]);
  return (
    <Base
      file={file}
      og={og}
      title={format(copy.titleFormat, { title: text.title, brand: C.BRAND_T })}
      desc={text.description}
    >
      <Section eyebrow={text.eyebrow} heading={text.heading} h1 lede={text.lede} />
      <Section>
        {[...prefectures].map(([prefecture, entries]) => (
          <div className="entry-group" key={prefecture}>
            <h2 className="entry-subheading">{prefecture}</h2>
            <ul className="entry-links">
              {entries.map((entry) => (
                <li key={entry.slug}>
                  <a href={entry.path}>{entry.municipality}</a>
                  {entry.service === 'partial' && (
                    <span className="entry-kind">{text.service.partial}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Cta />
      </Section>
    </Base>
  );
}
