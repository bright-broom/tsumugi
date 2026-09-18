/**
 * Site languages (ADR 0081). One build renders one language; additional languages are built
 * separately and published under their base path (e.g. /en/) by tools/scripts/build-locales.ts.
 * Shared assets (theme.css, /images/, fonts) stay at the site root for every language.
 */

export const LOCALE_SETTINGS = {
  ja: { language: 'ja', openGraph: 'ja_JP', number: 'en-US', basePath: '' },
  en: { language: 'en', openGraph: 'en_US', number: 'en-US', basePath: '/en' },
} as const;
export type LocaleId = keyof typeof LOCALE_SETTINGS;
export const DEFAULT_LOCALE: LocaleId = 'ja';

export function parseLocale(value: string | undefined): LocaleId {
  const locale = value?.trim() || DEFAULT_LOCALE;
  if (!Object.hasOwn(LOCALE_SETTINGS, locale)) throw new Error(`Unsupported locale: ${locale}`);
  return locale as LocaleId;
}

/** The language this build renders. Set only by the locale build script; defaults to Japanese. */
export const BUILD_LOCALE: LocaleId = parseLocale(
  typeof process === 'undefined' ? undefined : process.env.SITE_LOCALE,
);

/** Path of an output file (`price.html`, `news/a.html`) in a locale: `/price.html`, `/en/price.html`. */
export function localePath(file: string, locale: LocaleId = BUILD_LOCALE): string {
  return `${LOCALE_SETTINGS[locale].basePath}/${file}`;
}
