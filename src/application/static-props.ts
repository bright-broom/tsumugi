import { getMessages } from '@/i18n/catalog';
import { ROUTES, type RouteId } from '@/routing/registry';
import type { AnyCollectionPageProps, AnyPageProps, SharedMessages } from '@/content/page-props';
import {
  SITE_COLLECTIONS,
  collectionListPath,
  collectionOgPath,
  collectionRoutes,
  type SiteCollections,
} from '@/content/collections';
import { verifyPass } from '@/lib/measured';

function sharedMessages(): SharedMessages {
  const { shell, cta, entry, plans, table, vs, diagrams } = getMessages();
  return { shell, cta, entry, plans, table, vs, diagrams };
}

/** Called only from getStaticProps; filesystem access stays in the build process. */
export function pageProps(route: RouteId): AnyPageProps {
  const catalog = getMessages();
  const template = ROUTES[route].template;
  // Both discriminator and copy are selected by the same registry key. TS does not
  // distribute a computed indexed access into the union, so assert only here.
  return {
    route,
    template,
    copy: catalog[template],
    messages: sharedMessages(),
    pass: route === 'works' ? verifyPass() : '',
  } as AnyPageProps;
}

/** Next.js params for generated pages: lists use `[page]`, entries use `[page]/[slug]`. */
export function collectionPaths(
  kind: 'list' | 'entry',
  site: SiteCollections = SITE_COLLECTIONS,
): { page: string; slug: string }[] {
  return collectionRoutes(site)
    .filter((route) => route.kind === kind)
    .map((route) => {
      const [page = '', slug = ''] = route.file.replace(/\.html$/, '').split('/');
      return { page, slug };
    });
}

function summarize<T extends { body: unknown }>(entry: T, path: string) {
  const summary: Partial<T> = { ...entry };
  delete summary.body;
  return { ...(summary as Omit<T, 'body'>), path };
}

/** Props for one generated page, or undefined when the file is not a published route. */
export function collectionPageProps(
  file: string,
  site: SiteCollections = SITE_COLLECTIONS,
): AnyCollectionPageProps | undefined {
  const routes = collectionRoutes(site);
  const route = routes.find((candidate) => candidate.file === file);
  if (!route) return undefined;
  const { collection } = route;
  const pathOf = (slug: string) =>
    routes.find((candidate) => candidate.collection === collection && candidate.slug === slug)!
      .path;
  const common = {
    file,
    listPath: collectionListPath(collection),
    copy: getMessages().collections,
    messages: sharedMessages(),
  };
  const find = <T extends { slug: string }>(entries: T[]) =>
    entries.find((entry) => entry.slug === route.slug)!;

  if (collection === 'articles') {
    if (route.kind === 'list')
      return {
        ...common,
        template: 'articleList',
        og: collectionOgPath(collection),
        data: {
          entries: site.articles.published.map((entry) => summarize(entry, pathOf(entry.slug))),
        },
      };
    const entry = find(site.articles.published);
    return { ...common, template: 'article', og: collectionOgPath(collection, entry), data: { entry } };
  }
  if (collection === 'cases') {
    const { taxonomy, facets } = site.cases;
    if (route.kind === 'list')
      return {
        ...common,
        template: 'caseList',
        og: collectionOgPath(collection),
        data: {
          entries: site.cases.published.map((entry) => summarize(entry, pathOf(entry.slug))),
          facets,
          taxonomy,
        },
      };
    const entry = find(site.cases.published);
    return {
      ...common,
      template: 'caseStudy',
      og: collectionOgPath(collection, entry),
      data: { entry, taxonomy },
    };
  }
  if (collection === 'areas') {
    if (route.kind === 'list')
      return {
        ...common,
        template: 'areaList',
        og: collectionOgPath(collection),
        data: {
          entries: site.areas.published.map((entry) => summarize(entry, pathOf(entry.slug))),
        },
      };
    const entry = find(site.areas.published);
    return { ...common, template: 'area', og: collectionOgPath(collection, entry), data: { entry } };
  }
  const entry = find(site.works.published);
  return { ...common, template: 'work', og: collectionOgPath(collection, entry), data: { entry } };
}
