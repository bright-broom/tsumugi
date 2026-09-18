import { DOMAIN, PUBLISHED_LOCALES } from '@/content/config';
import {
  SITE_COLLECTIONS,
  collectionRoutes,
  loadCollections,
  type SiteCollections,
} from '@/content/collections';
import { getMessages } from '@/i18n/catalog';
import { BUILD_LOCALE, type LocaleId } from '@/lib/locale';
import { PUBLIC_ROUTES, canonical } from '@/routing/registry';

/**
 * sitemap.xml: fixed public pages (404 excluded) in registry order, then published collection
 * pages with their last modification date. Drafts and empty collections add nothing.
 * With several languages (ADR 0081) every language is listed in PUBLISHED_LOCALES order, each with
 * the collections of its own catalog.
 */
export function sitemapXml(
  site: SiteCollections = SITE_COLLECTIONS,
  domain = DOMAIN,
  locales: readonly LocaleId[] = PUBLISHED_LOCALES,
): string {
  const urls = locales.flatMap((locale) => {
    const collections =
      locale === BUILD_LOCALE ? site : loadCollections(getMessages(locale).entries);
    const fixed = PUBLIC_ROUTES.map(
      (route) => `  <url><loc>${canonical(domain, route.file, locale)}</loc></url>\n`,
    );
    const generated = collectionRoutes(collections).map(
      (route) =>
        `  <url><loc>${canonical(domain, route.file, locale)}</loc>${
          route.lastmod ? `<lastmod>${route.lastmod}</lastmod>` : ''
        }</url>\n`,
    );
    return [...fixed, ...generated];
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('') +
    '</urlset>\n'
  );
}
