import * as C from '@/content/config';
import type { CollectionPageProps } from '@/content/page-props';
import { format } from '@/i18n/format';
import { esc } from '@/lib/raw';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Cta from '@/components/Cta';
import Blocks from '@/components/collections/Blocks';
import EntryImage from '@/components/collections/EntryImage';

export default function CaseStudyPage({
  file,
  og,
  listPath,
  copy,
  data,
}: CollectionPageProps<'caseStudy'>) {
  const { entry, taxonomy } = data;
  const text = copy.cases;
  const industry = taxonomy.industries.find((option) => option.id === entry.industry);
  const area = taxonomy.areas.find((option) => option.id === entry.area);
  const tags = [
    ...entry.categories.map(
      (id) => industry?.categories.find((option) => option.id === id)?.label ?? id,
    ),
    ...(area ? [area.label] : []),
  ];
  const fields = (industry?.fields ?? []).filter((field) => entry.fields[field.id]?.trim());
  const bodyImage = entry.body.some((block) => block.type === 'image');
  return (
    <Base
      file={file}
      og={og}
      title={format(copy.titleFormat, { title: entry.seo.title || entry.title, brand: C.BRAND_T })}
      desc={entry.seo.description}
    >
      <Section eyebrow={industry?.label} heading={esc(entry.title)} h1 lede={esc(entry.summary)}>
        <ul className="entry-tags">
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      </Section>
      <Section>
        <div className="entry-article">
          {entry.image && <EntryImage className="entry-hero" image={entry.image} priority />}
          {fields.length > 0 && (
            <>
              <h2 className="entry-subheading">{text.details}</h2>
              <dl className="entry-facts">
                {fields.map((field) => (
                  <div key={field.id}>
                    <dt>{field.label}</dt>
                    <dd>{entry.fields[field.id]}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {entry.body.length > 0 && <Blocks blocks={entry.body} priorityImage={!entry.image} />}
          {entry.gallery.length > 0 && (
            <>
              <h2 className="entry-subheading">{text.gallery}</h2>
              <ul className="entry-gallery">
                {entry.gallery.map((image, index) => (
                  <li key={image.src}>
                    <EntryImage image={image} priority={!entry.image && !bodyImage && index === 0} />
                  </li>
                ))}
              </ul>
            </>
          )}
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
