import { ja } from '@/i18n/locales/ja';
import type { LocaleId } from '@/lib/locale';

/** The Japanese catalog is the source: its literal types also check message placeholders. */
export type Messages = typeof ja;

type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? readonly Widen<U>[]
        : T extends object
          ? { readonly [K in keyof T]: Widen<T[K]> }
          : T;

/** Shape a translated catalog must have: every key of the Japanese catalog, any wording. */
export type Translation = Widen<Messages>;

const TOKENS = /\{[A-Za-z][A-Za-z0-9]*\}|@route:[a-z0-9-]+|@brand:name/g;
const tokens = (text: string) =>
  [...text.matchAll(TOKENS)]
    .map((m) => m[0])
    .sort()
    .join(' ');

/**
 * Differences that would break a page in another language: missing or extra keys, different
 * list lengths, and placeholders or route links that do not match the Japanese copy.
 */
export function compareCatalogs(source: unknown, translation: unknown, path = ''): string[] {
  const at = path || '(root)';
  if (typeof source === 'string')
    return typeof translation !== 'string'
      ? [`${at}: text is missing`]
      : tokens(source) === tokens(translation)
        ? []
        : [
            `${at}: placeholders differ (${tokens(source) || 'none'} / ${tokens(translation) || 'none'})`,
          ];
  if (Array.isArray(source)) {
    if (!Array.isArray(translation)) return [`${at}: list is missing`];
    if (source.length !== translation.length)
      return [`${at}: list has ${translation.length} items, expected ${source.length}`];
    return source.flatMap((item, i) => compareCatalogs(item, translation[i], `${path}[${i}]`));
  }
  if (source && typeof source === 'object') {
    if (!translation || typeof translation !== 'object' || Array.isArray(translation))
      return [`${at}: section is missing`];
    const extra = Object.keys(translation).filter((key) => !Object.hasOwn(source, key));
    return [
      ...extra.map((key) => `${path ? `${path}.` : ''}${key}: not in the Japanese catalog`),
      ...Object.entries(source).flatMap(([key, child]) =>
        compareCatalogs(
          child,
          (translation as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
        ),
      ),
    ];
  }
  return typeof source === typeof translation ? [] : [`${at}: value type differs`];
}

/** Register an approved translation; a mismatch with the Japanese catalog stops the build. */
export function translated(locale: LocaleId, catalog: Translation): Messages {
  const problems = compareCatalogs(ja, catalog);
  if (problems.length)
    throw new Error(
      `Catalog ${locale} does not match ja:\n  ${problems.slice(0, 20).join('\n  ')}`,
    );
  return catalog as unknown as Messages;
}

/**
 * Approved catalogs by language (ADR 0081). To publish another language, add e.g.
 * `en: translated('en', en)` with `en` from ./en, and list it in content/config.ts PUBLISHED_LOCALES.
 */
export const CATALOGS: Partial<Record<LocaleId, Messages>> = { ja };
