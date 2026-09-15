import * as C from '@/content/config';
import type { CollectionPageProps } from '@/content/page-props';
import { format } from '@/i18n/format';
import { esc } from '@/lib/raw';
import { clientName } from '@/lib/collections/works';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Blocks from '@/components/collections/Blocks';
import { formatDate } from '@/components/collections/EntryDates';
import EntryImage from '@/components/collections/EntryImage';
import MetricTable from '@/components/collections/MetricTable';

export default function WorkPage({ file, og, listPath, copy, data }: CollectionPageProps<'work'>) {
  const { entry } = data;
  const text = copy.works;
  const scope = new Set(entry.permission.scope);
  const name = clientName(entry);
  const image = scope.has('images') ? entry.image : undefined;
  const lists = [
    [text.outcomes, entry.outcomes.filter((item) => item.trim())],
    [text.setbacks, entry.setbacks.filter((item) => item.trim())],
  ] as const;
  return (
    <Base
      file={file}
      og={og}
      title={format(copy.titleFormat, { title: entry.seo.title || entry.title, brand: C.BRAND_T })}
      desc={entry.seo.description}
    >
      <Section eyebrow={text.eyebrow} heading={esc(entry.title)} h1 lede={esc(entry.summary)}>
        <dl className="entry-facts">
          <div>
            <dt>{text.client}</dt>
            <dd>{name ?? text.unnamed}</dd>
          </div>
          <div>
            <dt>{text.industry}</dt>
            <dd>{entry.client.industry}</dd>
          </div>
          {entry.client.area && (
            <div>
              <dt>{text.area}</dt>
              <dd>{entry.client.area}</dd>
            </div>
          )}
          {entry.launchedAt && (
            <div>
              <dt>{text.launchedAt}</dt>
              <dd>
                <time dateTime={entry.launchedAt}>{formatDate(copy, entry.launchedAt)}</time>
              </dd>
            </div>
          )}
        </dl>
      </Section>
      <Section>
        <div className="entry-article">
          {image && <EntryImage className="entry-hero" image={image} priority />}
          {scope.has('metrics') && entry.metrics.length > 0 && (
            <>
              <h2 className="entry-subheading">{text.metrics}</h2>
              <MetricTable copy={copy} metrics={entry.metrics} />
            </>
          )}
          {lists.map(
            ([heading, items]) =>
              items.length > 0 && (
                <div key={heading}>
                  <h2 className="entry-subheading">{heading}</h2>
                  <ul className="entry-points">
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ),
          )}
          {scope.has('body') && entry.body.length > 0 && (
            <Blocks blocks={entry.body} priorityImage={!image} />
          )}
          {scope.has('url') && entry.url && (
            <p>
              <a className="more" href={entry.url} rel="noopener">
                {text.visit}
              </a>
            </p>
          )}
          {entry.permission.recordedAt && (
            <p className="entry-note">
              {format(text.permission, { date: formatDate(copy, entry.permission.recordedAt) })}
            </p>
          )}
          <p className="entry-back">
            <a className="more" href={listPath}>
              {text.backToWorks}
            </a>
          </p>
        </div>
      </Section>
    </Base>
  );
}
