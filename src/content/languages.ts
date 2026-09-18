import { PUBLISHED_LOCALES } from '@/content/config';
import { getMessages } from '@/i18n/catalog';
import { BUILD_LOCALE, LOCALE_SETTINGS, localePath, type LocaleId } from '@/lib/locale';

export interface LanguageLink {
  locale: LocaleId;
  language: string;
  /** Name of the language in that language (e.g. English, 日本語). */
  name: string;
  href: string;
}

/**
 * Links to the same page in the other published languages (ADR 0081).
 * Empty while the site publishes one language, so single-language output does not change.
 */
export function languageLinks(
  file: string,
  locales: readonly LocaleId[] = PUBLISHED_LOCALES,
): LanguageLink[] {
  if (locales.length < 2) return [];
  return locales
    .filter((locale) => locale !== BUILD_LOCALE)
    .map((locale) => ({
      locale,
      language: LOCALE_SETTINGS[locale].language,
      name: getMessages(locale).shell.language.name,
      href: localePath(file, locale),
    }));
}
