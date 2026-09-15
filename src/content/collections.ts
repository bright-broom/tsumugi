import { getMessages } from '@/i18n/catalog';
import {
  assertCollectionBase,
  collectionEntryFile,
  collectionListFile,
} from '@/routing/collections';
import { ROUTES, type RouteId } from '@/routing/registry';
import type { IconName } from '@/lib/icons';
import {
  CollectionError,
  duplicateSlugs,
  isPublished,
  parseCollection,
  sortEntries,
  type BaseEntry,
  type CollectionProblem,
} from '@/lib/collections/core';
import { articleReadiness, articlesSchema, type Article } from '@/lib/collections/articles';
import {
  caseFacets,
  caseReadiness,
  casesSchema,
  type CaseStudy,
  type CaseTaxonomy,
  type Facet,
} from '@/lib/collections/cases';
import {
  areaDuplicates,
  areaReadiness,
  areasSchema,
  type ServiceArea,
} from '@/lib/collections/areas';
import { workReadiness, worksSchema, type Work } from '@/lib/collections/works';

/**
 * Collections of this site: where each one is published and which existing share card it reuses.
 * Another site changes these settings and its locale entries, not the engine in lib/collections/.
 */
export const COLLECTION_IDS = ['articles', 'cases', 'areas', 'works'] as const;
export type CollectionId = (typeof COLLECTION_IDS)[number];

interface CollectionSettings {
  /** URL segment: `/<base>.html` for the list, `/<base>/<slug>.html` for entries. */
  base: string;
  /** null generates the list page; a route id attaches entries to that existing page instead. */
  attachedTo: RouteId | null;
  icon: IconName;
  /** Existing card under public/og/ used when an entry has no share image of its own. */
  ogCard: RouteId;
}

const COLLECTION_SETTINGS: Record<CollectionId, CollectionSettings> = {
  articles: { base: 'news', attachedTo: null, icon: 'file-text', ogCard: 'index' },
  cases: { base: 'cases', attachedTo: null, icon: 'camera', ogCard: 'index' },
  areas: { base: 'areas', attachedTo: null, icon: 'map-pin', ogCard: 'index' },
  works: { base: 'works', attachedTo: 'works', icon: 'image', ogCard: 'works' },
};
for (const { base, attachedTo } of Object.values(COLLECTION_SETTINGS))
  assertCollectionBase(base, attachedTo);

/** Raw documents, typically `getMessages().entries`; tests pass fixtures instead. */
export interface CollectionSource {
  articles: unknown;
  cases: unknown;
  areas: unknown;
  works: unknown;
}

interface Collection<T> {
  all: T[];
  published: T[];
}
export interface SiteCollections {
  articles: Collection<Article>;
  cases: Collection<CaseStudy> & { taxonomy: CaseTaxonomy; facets: Facet[] };
  areas: Collection<ServiceArea>;
  works: Collection<Work>;
}

interface DraftReport {
  collection: CollectionId;
  slug: string;
  slot: string | null;
  missing: string[];
}

export interface CollectionReview {
  /** Problems that block the build: invalid published entries, duplicate slugs or pages. */
  problems: CollectionProblem[];
  /** What each draft still needs before it can be published (the intake report). */
  drafts: DraftReport[];
  site: SiteCollections;
}

function review<T extends BaseEntry>(
  collection: CollectionId,
  entries: T[],
  readiness: (entry: T) => string[],
  result: Pick<CollectionReview, 'problems' | 'drafts'>,
): Collection<T> {
  for (const slug of duplicateSlugs(entries))
    result.problems.push({ collection, slug, reason: 'slug is used more than once' });
  for (const entry of entries) {
    const missing = readiness(entry);
    if (isPublished(entry))
      for (const reason of missing) result.problems.push({ collection, slug: entry.slug, reason });
    else {
      const intake = (entry as { intake?: { slot: string } }).intake;
      result.drafts.push({ collection, slug: entry.slug, slot: intake?.slot ?? null, missing });
    }
  }
  return { all: entries, published: sortEntries(entries.filter(isPublished)) };
}

/** Validate every document without throwing, so tools can report all problems at once. */
export function reviewCollections(source: CollectionSource): CollectionReview {
  const result: Pick<CollectionReview, 'problems' | 'drafts'> = { problems: [], drafts: [] };
  const articles = parseCollection('articles', articlesSchema, source.articles);
  const cases = parseCollection('cases', casesSchema, source.cases);
  const areas = parseCollection('areas', areasSchema, source.areas);
  const works = parseCollection('works', worksSchema, source.works);
  const taxonomyIds = [
    ...cases.taxonomy.industries.map(({ id }) => ({ slug: id })),
    ...cases.taxonomy.areas.map(({ id }) => ({ slug: `area-${id}` })),
  ];
  for (const slug of duplicateSlugs(taxonomyIds))
    result.problems.push({ collection: 'cases', slug, reason: 'taxonomy id is used more than once' });
  const site: SiteCollections = {
    articles: review('articles', articles.entries, articleReadiness, result),
    cases: {
      ...review('cases', cases.entries, (entry) => caseReadiness(entry, cases.taxonomy), result),
      taxonomy: cases.taxonomy,
      facets: [],
    },
    areas: review('areas', areas.entries, areaReadiness, result),
    works: review('works', works.entries, workReadiness, result),
  };
  for (const duplicate of areaDuplicates(site.areas.published))
    result.problems.push({ collection: 'areas', ...duplicate });
  try {
    site.cases.facets = caseFacets(cases.taxonomy, site.cases.published);
  } catch (error) {
    result.problems.push({ collection: 'cases', slug: '-', reason: (error as Error).message });
  }
  return { ...result, site };
}

/** Build-time loader: any blocking problem stops the build instead of publishing a broken page. */
export function loadCollections(source: CollectionSource): SiteCollections {
  const { problems, site } = reviewCollections(source);
  if (problems.length) throw new CollectionError(problems);
  return site;
}

export interface CollectionRoute {
  collection: CollectionId;
  kind: 'list' | 'entry';
  slug: string | null;
  file: string;
  path: string;
  lastmod: string | null;
}

const lastModified = (entry: BaseEntry) => entry.updatedAt ?? entry.publishedAt ?? null;

/** Every generated page. Collections without published entries produce no routes at all. */
export function collectionRoutes(site: SiteCollections): CollectionRoute[] {
  return COLLECTION_IDS.flatMap((collection) => {
    const { base, attachedTo } = COLLECTION_SETTINGS[collection];
    const published: BaseEntry[] = site[collection].published;
    if (!published.length) return [];
    const entries = published.map((entry): CollectionRoute => {
      const file = collectionEntryFile(base, entry.slug);
      return { collection, kind: 'entry', slug: entry.slug, file, path: `/${file}`, lastmod: lastModified(entry) };
    });
    if (attachedTo !== null) return entries;
    const file = collectionListFile(base);
    const dates = published.map(lastModified).filter((date): date is string => date !== null);
    const lastmod = dates.length ? dates.sort().at(-1)! : null;
    return [{ collection, kind: 'list', slug: null, file, path: `/${file}`, lastmod }, ...entries];
  });
}

export function collectionListPath(collection: CollectionId): string {
  const { base, attachedTo } = COLLECTION_SETTINGS[collection];
  return attachedTo === null ? `/${collectionListFile(base)}` : ROUTES[attachedTo].path;
}

/** Share card path under public/og/: the entry's own image or the collection's existing card. */
export function collectionOgPath(collection: CollectionId, entry?: BaseEntry): string {
  return entry?.seo.ogImage ?? `/og/${ROUTES[COLLECTION_SETTINGS[collection].ogCard].id}.png`;
}

export interface CollectionNavEntry {
  id: string;
  file: string;
  path: string;
  icon: IconName;
  label: string;
}

/** Generated list pages join the site navigation only once they have something to show. */
export function collectionNavEntries(site: SiteCollections): CollectionNavEntry[] {
  const copy = getMessages().collections;
  return collectionRoutes(site)
    .filter((route) => route.kind === 'list')
    .map((route) => ({
      id: `collection-${route.collection}`,
      file: route.file,
      path: route.path,
      icon: COLLECTION_SETTINGS[route.collection].icon,
      label: copy[route.collection as Exclude<CollectionId, 'works'>].navLabel,
    }));
}

export const SITE_COLLECTIONS = loadCollections(getMessages().entries);
