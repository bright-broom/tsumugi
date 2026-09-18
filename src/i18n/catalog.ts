import { spaceCopy } from '@/i18n/html-typography';
import { CATALOGS, type Messages } from '@/i18n/locales';
import { BUILD_LOCALE, LOCALE_SETTINGS, parseLocale } from '@/lib/locale';
import { getRoute } from '@/routing/registry';

export type { Messages } from '@/i18n/locales';
/** The build language (ADR 0081). Japanese unless the locale build script selects another. */
export const LOCALE = LOCALE_SETTINGS[BUILD_LOCALE];

function resolveLinks(value: unknown, brand: string): unknown {
  if (typeof value === 'string')
    return spaceCopy(
      value.replaceAll('@brand:name', brand).replace(/@route:([a-z0-9-]+)/g, (_, id: string) => {
        const route = getRoute(id);
        if (!route) throw new Error(`Unknown catalog route: ${id}`);
        return route.path;
      }),
    );
  if (Array.isArray(value)) return value.map((child) => resolveLinks(child, brand));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, resolveLinks(child, brand)]),
    );
  return value;
}

// Keys and placeholders retain their shape; visible copy gains consistent spacing.
const resolved = new Map<string, Messages>();

/**
 * Locale is chosen at build time. A language without an approved catalog fails instead of
 * silently falling back to Japanese and mixing languages on one page.
 */
export function getMessages(locale: string = BUILD_LOCALE): Messages {
  const id = parseLocale(locale);
  const catalog = CATALOGS[id];
  if (!catalog) throw new Error(`No catalog for locale: ${id}`);
  if (!resolved.has(id)) resolved.set(id, resolveLinks(catalog, catalog.config.brand) as Messages);
  return resolved.get(id)!;
}
