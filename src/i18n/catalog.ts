import { spaceCopy } from '@/i18n/html-typography';
import { ja } from '@/i18n/locales/ja';
import { getRoute } from '@/routing/registry';

const DEFAULT_LOCALE = 'ja' as const;
export const LOCALE = { language: 'ja', openGraph: 'ja_JP', number: 'en-US' } as const;
export type Messages = typeof ja;

function resolveLinks(value: unknown): unknown {
  if (typeof value === 'string')
    return spaceCopy(
      value
        .replaceAll('@brand:name', ja.config.brand)
        .replace(/@route:([a-z0-9-]+)/g, (_, id: string) => {
          const route = getRoute(id);
          if (!route) throw new Error(`Unknown catalog route: ${id}`);
          return route.path;
        }),
    );
  if (Array.isArray(value)) return value.map(resolveLinks);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, resolveLinks(child)]),
    );
  return value;
}

// Keys and placeholders retain their shape; visible copy gains consistent spacing.
const messages = resolveLinks(ja) as Messages;

/** Locale is chosen at build time. Unsupported locales fail instead of silently mixing languages. */
export function getMessages(locale: string = DEFAULT_LOCALE): Messages {
  if (locale !== DEFAULT_LOCALE) throw new Error(`Unsupported locale: ${locale}`);
  return messages;
}
