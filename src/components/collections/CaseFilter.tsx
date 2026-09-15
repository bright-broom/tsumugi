import { clsx } from 'clsx';
import type { Messages } from '@/i18n/catalog';
import {
  FILTER_LIMITS,
  facetPositions,
  type CaseStudy,
  type CaseTaxonomy,
  type Facet,
} from '@/lib/collections/cases';
import EntryImage from '@/components/collections/EntryImage';

type CaseSummary = Omit<CaseStudy, 'body'> & { path: string };
const slots = Array.from({ length: FILTER_LIMITS.facets }, (_, index) => index + 1);

/**
 * Case study list with a filter that needs no JavaScript.
 *
 * Radio inputs are direct children of the form, before the controls and the list, so sibling
 * selectors in src/styles/collections.css can hide non-matching items (`fN-vM` = facet N, value M;
 * value 0 = all). The native reset button restores the default "all" choices. Facet slots that the
 * data does not use keep a hidden, checked "all" input so the empty-state selector stays complete.
 */
export default function CaseFilter({
  copy,
  entries,
  facets,
  taxonomy,
}: {
  copy: Messages['collections']['cases'];
  entries: readonly CaseSummary[];
  facets: readonly Facet[];
  taxonomy: CaseTaxonomy;
}) {
  const lead = entries.findIndex((entry) => entry.image);
  const label = (list: readonly { id: string; label: string }[], id?: string) =>
    list.find((option) => option.id === id)?.label;
  const cards = entries.map((entry, index) => {
    const industry = label(taxonomy.industries, entry.industry);
    const area = label(taxonomy.areas, entry.area);
    const positions = facets.length ? facetPositions(facets, entry) : [];
    return (
      <li
        className={clsx(
          'entry-card',
          facets.length && 'cf-item',
          positions.flatMap((values, facet) => values.map((value) => `cf-i${facet + 1}-v${value}`)),
        )}
        key={entry.slug}
      >
        {entry.image && <EntryImage image={entry.image} priority={index === lead} />}
        <p className="entry-kind">
          {industry && <span>{industry}</span>}
          {area && <span>{area}</span>}
        </p>
        <h2 className="entry-title">
          <a href={entry.path}>{entry.title}</a>
        </h2>
        <p className="entry-summary">{entry.summary}</p>
      </li>
    );
  });

  if (!facets.length)
    return (
      <ul className="entry-list" aria-label={copy.results}>
        {cards}
      </ul>
    );

  return (
    <form className="cf" aria-label={copy.filter}>
      {slots.map((slot) => {
        const facet = facets[slot - 1];
        if (!facet)
          return (
            <input
              key={slot}
              className={`cf-radio cf-f${slot}-v0`}
              type="radio"
              name={`unused-${slot}`}
              value=""
              defaultChecked
              hidden
            />
          );
        return [{ id: '', label: copy.all }, ...facet.values].map((value, index) => (
          <input
            key={`${slot}-${index}`}
            className={`cf-radio cf-f${slot}-v${index}`}
            id={`cf-f${slot}-v${index}`}
            type="radio"
            name={facet.id}
            value={value.id}
            defaultChecked={index === 0}
            aria-describedby={`cf-facet-${slot}`}
          />
        ));
      })}
      <div className="cf-controls">
        {facets.map((facet, facetIndex) => (
          <div className="cf-facet" key={facet.id}>
            <p className="cf-facet-title" id={`cf-facet-${facetIndex + 1}`}>
              {copy.facets[facet.id]}
            </p>
            <div className="cf-options">
              {[copy.all, ...facet.values.map((value) => value.label)].map((text, index) => (
                <label
                  key={index}
                  className={`cf-chip cf-l${facetIndex + 1}-v${index}`}
                  htmlFor={`cf-f${facetIndex + 1}-v${index}`}
                >
                  {text}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button className="cf-reset" type="reset">
          {copy.reset}
        </button>
      </div>
      <ul className="entry-list cf-list" aria-label={copy.results}>
        {cards}
      </ul>
      <p className="cf-empty">{copy.empty}</p>
    </form>
  );
}
