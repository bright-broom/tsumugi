import { DOMAIN } from '@/content/config';
import {
  SITE_COLLECTIONS,
  collectionRoutes,
  type SiteCollections,
} from '@/content/collections';
import { PUBLIC_ROUTES, canonical } from '@/routing/registry';

/**
 * sitemap.xml: fixed public pages (404 excluded) in registry order, then published collection
 * pages with their last modification date. Drafts and empty collections add nothing.
 */
export function sitemapXml(site: SiteCollections = SITE_COLLECTIONS, domain = DOMAIN): string {
  const fixed = PUBLIC_ROUTES.map((route) => `  <url><loc>${canonical(domain, route.file)}</loc></url>\n`);
  const generated = collectionRoutes(site).map(
    (route) =>
      `  <url><loc>${canonical(domain, route.file)}</loc>${
        route.lastmod ? `<lastmod>${route.lastmod}</lastmod>` : ''
      }</url>\n`,
  );
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...fixed, ...generated].join('') +
    '</urlset>\n'
  );
}
