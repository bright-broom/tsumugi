import { getMessages } from '@/i18n/catalog';
import { ALL_ROUTES, INDUSTRY_ROUTES, ROUTES, type Route } from '@/routing/registry';
import type { IconName } from '@/lib/icons';
import {
  SITE_COLLECTIONS,
  collectionNavEntries,
  type SiteCollections,
} from '@/content/collections';
const copy = getMessages().nav;
const entry = (r: Exclude<Route, { kind: 'error' }>): [string, string] => [
  r.file,
  copy.labels[r.id],
];
export const NAV = ALL_ROUTES.filter((r) => r.kind === 'main').map(entry);
export const NAV_MAIN = ALL_ROUTES.filter((r) => r.kind !== 'error' && r.header).map((r) =>
  entry(r as Exclude<Route, { kind: 'error' }>),
);
export const NAV_LEGAL = ALL_ROUTES.filter((r) => r.kind === 'legal').map(entry);
export const NAV_IC: Record<string, IconName> = Object.fromEntries(
  ALL_ROUTES.flatMap((r) => [
    [r.file, r.icon],
    [r.path, r.icon],
  ]),
);
export const INDUSTRIES: [string, string, string][] = INDUSTRY_ROUTES.map((r) => [
  r.file,
  copy.labels[r.id],
  copy.industries[r.id],
]);
export const IND_IC: Record<string, IconName> = Object.fromEntries(
  INDUSTRY_ROUTES.map((r) => [r.file, r.icon]),
);

// Group membership is shared by the expanded header menu and footer.
const GROUP_ROUTES = {
  service: ['index', 'owned', 'source', 'spec'],
  costs: ['price', 'unlimited', 'cost-cut', 'subsidy'],
  next: ['flow', 'works', 'faq', 'about', 'contact'],
} as const satisfies Record<
  keyof typeof copy.groups,
  readonly Extract<Route, { kind: 'main' }>['id'][]
>;

/** Generated collection lists follow the works page once they have published entries. */
export function navigationGroups(site: SiteCollections = SITE_COLLECTIONS) {
  const collections = collectionNavEntries(site);
  return Object.entries(GROUP_ROUTES).map(([id, routes]) => ({
    id,
    label: copy.groups[id as keyof typeof copy.groups],
    entries: routes.flatMap((routeId) => {
      const { file, path, icon } = ROUTES[routeId];
      return [
        { id: routeId as string, file, path, icon, label: copy.labels[routeId] as string },
        ...(routeId === 'works' ? collections : []),
      ];
    }),
  }));
}
export const NAV_GROUPS = navigationGroups();
