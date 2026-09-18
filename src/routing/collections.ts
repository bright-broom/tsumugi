import { LOCALE_SETTINGS } from '@/lib/locale';
import { getRoute } from '@/routing/registry';

/**
 * Generated collection pages keep the flat `.html` convention one level deep:
 * `/news.html` lists entries and `/news/<slug>.html` shows one. Nested files work on any host.
 */
const BASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set([
  'og',
  'images',
  'fonts',
  'theme',
  'sitemap',
  'robots',
  'index',
  '404',
  // Language directories (ADR 0081) must not be taken by a collection.
  ...Object.values(LOCALE_SETTINGS).map((l) => l.basePath.replace(/^\//, '')).filter(Boolean),
]);

export function collectionListFile(base: string): string {
  return `${base}.html`;
}

export function collectionEntryFile(base: string, slug: string): string {
  return `${base}/${slug}.html`;
}

/**
 * A generated list must not shadow a fixed page. A collection may instead attach its entries to an
 * existing page (works.html lists client work), in which case the base must be that page's id.
 */
export function assertCollectionBase(base: string, attachedTo: string | null): void {
  if (!BASE.test(base) || RESERVED.has(base)) throw new Error(`Invalid collection base: ${base}`);
  if (attachedTo === null && getRoute(base))
    throw new Error(`Collection base collides with a fixed route: ${base}`);
  if (attachedTo !== null && !getRoute(attachedTo))
    throw new Error(`Collection is attached to an unknown route: ${attachedTo}`);
}

/** Absolute URL of an image that already exists under public/. */
export function publicImageUrl(domain: string, path: string): string {
  return `https://${domain}${path}`;
}
