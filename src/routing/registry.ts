import type { IconName } from '@/lib/icons';
function route<
  const ID extends string,
  const Template extends string,
  const Kind extends 'main' | 'legal' | 'industry' | 'error',
>(id: ID, template: Template, icon: IconName, kind: Kind, header = false) {
  return {
    id,
    template,
    file: `${id}.html` as const,
    path: `/${id}.html` as const,
    icon,
    kind,
    header,
  };
}
export const ROUTES = {
  index: route('index', 'home', 'circle-dollar-sign', 'main', false),
  owned: route('owned', 'owned', 'key', 'main', true),
  price: route('price', 'price', 'calculator', 'main', true),
  plans: route('plans', 'catalog', 'list-checks', 'main', false),
  unlimited: route('unlimited', 'unlimited', 'repeat-2', 'main', false),
  source: route('source', 'source', 'code-xml', 'main', false),
  'cost-cut': route('cost-cut', 'costCut', 'trending-down', 'main', true),
  subsidy: route('subsidy', 'subsidy', 'hand-coins', 'main', true),
  spec: route('spec', 'spec', 'list-checks', 'main', false),
  flow: route('flow', 'flow', 'route', 'main', false),
  works: route('works', 'works', 'image', 'main', false),
  faq: route('faq', 'faq', 'circle-help', 'main', false),
  about: route('about', 'about', 'users', 'main', false),
  contact: route('contact', 'contact', 'message-circle', 'main', false),
  terms: route('terms', 'terms', 'scroll-text', 'legal', false),
  privacy: route('privacy', 'privacy', 'shield', 'legal', false),
  legal: route('legal', 'legal', 'landmark', 'legal', false),
  restaurant: route('restaurant', 'industry', 'utensils-crossed', 'industry', false),
  koumuten: route('koumuten', 'industry', 'hammer', 'industry', false),
  salon: route('salon', 'industry', 'scissors', 'industry', false),
  shigyo: route('shigyo', 'industry', 'scale', 'industry', false),
  '404': route('404', 'notFound', 'circle-help', 'error', false),
} as const;
export type RouteId = keyof typeof ROUTES;
export type Route = (typeof ROUTES)[RouteId];
export const ALL_ROUTES = Object.values(ROUTES);
export const PUBLIC_ROUTES = ALL_ROUTES.filter((r) => r.kind !== 'error');
export const STATIC_ROUTES = ALL_ROUTES.filter((r) => r.id !== 'index' && r.id !== '404');
export const INDUSTRY_ROUTES = ALL_ROUTES.filter((r) => r.kind === 'industry');
export function getRoute(id: string): Route | undefined {
  return Object.hasOwn(ROUTES, id) ? ROUTES[id as RouteId] : undefined;
}
export function href(id: RouteId, fragment?: string): string {
  return ROUTES[id].path + (fragment ? `#${fragment}` : '');
}
export function canonical(domain: string, file: string): string {
  return `https://${domain}/${file}`;
}
export function ogImage(domain: string, file: string): string {
  return `https://${domain}/og/${file.replace(/\.html$/, '')}.png`;
}

export function pathForFile(file: string): string {
  const route = ALL_ROUTES.find((route) => route.file === file || route.path === file);
  if (!route) throw new Error(`Unknown route file: ${file}`);
  return route.path;
}

export type TemplateId = Route['template'];
