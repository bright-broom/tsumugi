import {
  SITE_COLLECTIONS,
  collectionRoutes,
  type SiteCollections,
} from '@/content/collections';
import { getMessages } from '@/i18n/catalog';
import Section from '@/components/Section';
import EntryImage from '@/components/collections/EntryImage';

/**
 * Client work on works.html. Renders nothing until a permitted case is published, so the page keeps
 * its honest "no client cases yet" state. Copy comes from the collections catalog at build time.
 */
export default function PublishedWorks({ site = SITE_COLLECTIONS }: { site?: SiteCollections }) {
  const works = site.works.published;
  if (!works.length) return null;
  const copy = getMessages().collections.works;
  const paths = new Map(
    collectionRoutes(site)
      .filter((route) => route.collection === 'works')
      .map((route) => [route.slug, route.path]),
  );
  const images = works.map((work) =>
    work.permission.scope.includes('images') ? work.image : undefined,
  );
  const lead = images.findIndex(Boolean);
  return (
    <Section eyebrow={copy.eyebrow} heading={copy.heading} lede={copy.lede} className="works-cases">
      <ul className="entry-list">
        {works.map((work, index) => {
          const image = images[index];
          return (
            <li className="entry-card" key={work.slug}>
              {image && <EntryImage image={image} priority={index === lead} />}
              <p className="entry-kind">
                <span>{work.client.industry}</span>
              </p>
              <h3 className="entry-title">
                <a href={paths.get(work.slug)}>{work.title}</a>
              </h3>
              <p className="entry-summary">{work.summary}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
