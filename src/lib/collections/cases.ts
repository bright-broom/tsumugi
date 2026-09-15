import { z } from 'zod';
import {
  blockSchema,
  bodyReadiness,
  entryReadiness,
  entryShape,
  imageSchema,
  slugSchema,
} from '@/lib/collections/core';

const optionSchema = z.object({ id: slugSchema, label: z.string() });

/** Each industry declares its own categories and detail fields (e.g. period, structure, menu). */
const caseTaxonomySchema = z.object({
  industries: z.array(
    z.object({
      id: slugSchema,
      label: z.string(),
      categories: z.array(optionSchema),
      fields: z.array(optionSchema),
    }),
  ),
  areas: z.array(optionSchema),
});
const caseSchema = z.object({
  ...entryShape,
  industry: slugSchema,
  categories: z.array(slugSchema),
  area: slugSchema.optional(),
  summary: z.string(),
  fields: z.record(slugSchema, z.string()),
  gallery: z.array(imageSchema),
  body: z.array(blockSchema),
});
export const casesSchema = z.object({ taxonomy: caseTaxonomySchema, entries: z.array(caseSchema) });
export type CaseTaxonomy = z.infer<typeof caseTaxonomySchema>;
export type CaseStudy = z.infer<typeof caseSchema>;
export type CasesInput = z.input<typeof casesSchema>;

export function caseReadiness(entry: CaseStudy, taxonomy: CaseTaxonomy): string[] {
  const problems = [...entryReadiness(entry)];
  if (entry.body.length) problems.push(...bodyReadiness(entry.body));
  if (!entry.summary.trim()) problems.push('summary is empty');
  if (!entry.image) problems.push('image is required');
  entry.gallery.forEach((image, index) => {
    if (!image.alt.trim()) problems.push(`gallery[${index}].alt is empty`);
  });
  const industry = taxonomy.industries.find((item) => item.id === entry.industry);
  if (!industry) problems.push(`industry "${entry.industry}" is not in the taxonomy`);
  if (!entry.categories.length) problems.push('at least one category is required');
  for (const category of entry.categories)
    if (industry && !industry.categories.some((option) => option.id === category))
      problems.push(`category "${category}" is not defined for ${entry.industry}`);
  for (const field of Object.keys(entry.fields))
    if (industry && !industry.fields.some((option) => option.id === field))
      problems.push(`field "${field}" is not defined for ${entry.industry}`);
  if (entry.area && !taxonomy.areas.some((option) => option.id === entry.area))
    problems.push(`area "${entry.area}" is not in the taxonomy`);
  return problems;
}

/**
 * The CSS-only filter addresses facets and values by position (see src/styles/collections.css).
 * Raising a limit requires adding the matching selectors there; tests keep both in step.
 */
export const FILTER_LIMITS = { facets: 3, values: 12 } as const;
const FACET_IDS = ['industry', 'category', 'area'] as const;
type FacetId = (typeof FACET_IDS)[number];
export interface Facet {
  id: FacetId;
  values: { id: string; label: string }[];
}

type Classified = Pick<CaseStudy, 'industry' | 'categories' | 'area'>;

function valuesOf(entry: Classified, facet: FacetId): string[] {
  if (facet === 'industry') return [entry.industry];
  if (facet === 'category') return entry.categories;
  return entry.area ? [entry.area] : [];
}

/** Facets only offer values used by published entries; a facet with one value filters nothing. */
export function caseFacets(taxonomy: CaseTaxonomy, entries: readonly CaseStudy[]): Facet[] {
  const categories = new Map<string, string>();
  for (const industry of taxonomy.industries)
    for (const option of industry.categories)
      if (!categories.has(option.id)) categories.set(option.id, option.label);
  const options: Record<FacetId, { id: string; label: string }[]> = {
    industry: taxonomy.industries.map(({ id, label }) => ({ id, label })),
    category: [...categories].map(([id, label]) => ({ id, label })),
    area: taxonomy.areas,
  };
  const facets = FACET_IDS.map((id) => {
    const used = new Set(entries.flatMap((entry) => valuesOf(entry, id)));
    return { id, values: options[id].filter((option) => used.has(option.id)) };
  }).filter((facet) => facet.values.length > 1);
  for (const facet of facets)
    if (facet.values.length > FILTER_LIMITS.values)
      throw new Error(
        `Facet "${facet.id}" has ${facet.values.length} values; the CSS filter supports ${FILTER_LIMITS.values}`,
      );
  return facets;
}

/** 1-based value positions per facet (0 is reserved for "all"). */
export function facetPositions(facets: readonly Facet[], entry: Classified): number[][] {
  return facets.map((facet) =>
    facet.values.flatMap((value, index) =>
      valuesOf(entry, facet.id).includes(value.id) ? [index + 1] : [],
    ),
  );
}

/** Reference semantics of the CSS filter: AND across facets, one choice per facet, 0 = all. */
export function matchesSelection(
  facets: readonly Facet[],
  entry: Classified,
  selection: readonly number[],
): boolean {
  const positions = facetPositions(facets, entry);
  return facets.every((_, index) => {
    const chosen = selection[index] ?? 0;
    return chosen === 0 || positions[index]!.includes(chosen);
  });
}
