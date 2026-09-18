/**
 * 多言語の出力を検査する（ADR 0081）。統合後の out/ で、言語ごとに次を確かめる。
 * - <html lang>・canonical・og:locale が言語と一致する
 * - 複数言語なら、全言語と x-default の hreflang があり、対応先のページが存在する（相互参照）
 * - 内部リンク（.html）が同じ言語の中にあり、リンク先が存在する
 * - 日本語以外のページに日本語の文字が混ざらない（許可した固有名詞を除く）
 * - sitemap.xml に全ページが載っている
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAIN, PUBLISHED_LOCALES } from '@/content/config';
import { LOCALE_SETTINGS, type LocaleId } from '@/lib/locale';
import { ROOT } from '../paths';
import { localeHtmlFiles } from './build-locales';

const JAPANESE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/u;

const attr = (html: string, pattern: RegExp) => pattern.exec(html)?.[1] ?? null;

/** 画面に出る文字（タグ・コメント・style を除く。JSON-LD は検索結果に出るため含める） */
function visibleText(html: string, language: string): string {
  return (
    html
      // 言語の切り替えなど、lang で別の言語と明示した要素は除く（例：英語ページの「日本語」）
      .replace(
        new RegExp(`<([a-z]+)\\b[^>]*\\blang="(?!${language}")[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`, 'g'),
        ' ',
      )
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, ' $1 ')
      .replace(/<(?:meta|link)\b[^>]*\bcontent="([^"]*)"[^>]*>/g, ' $1 ')
      .replace(/\balt="([^"]*)"/g, ' $1 ')
      .replace(/<[^>]+>/g, ' ')
  );
}

export interface LocaleCheckOptions {
  out: string;
  domain: string;
  locales: readonly LocaleId[];
  /** 翻訳しない固有名詞（屋号・氏名・住所など）。日本語のまま載せてよい文字列 */
  allowedJapanese?: readonly string[];
}

export function checkLocales(options: LocaleCheckOptions): string[] {
  const { out, domain, locales } = options;
  const problems: string[] = [];
  const dirOf = (l: LocaleId) => LOCALE_SETTINGS[l].basePath.replace(/^\//, '');
  const otherDirs = new Set(locales.map(dirOf).filter(Boolean));
  const pagesOf = (l: LocaleId) => {
    const dir = dirOf(l);
    const root = dir ? join(out, dir) : out;
    if (!existsSync(root)) return [];
    return localeHtmlFiles(root).filter((file) => dir || !otherDirs.has(file.split('/')[0]!));
  };
  const pages = new Map(locales.map((l) => [l, new Set(pagesOf(l))]));
  const sitemap = existsSync(join(out, 'sitemap.xml'))
    ? readFileSync(join(out, 'sitemap.xml'), 'utf8')
    : '';
  const url = (l: LocaleId, file: string) =>
    `https://${domain}${LOCALE_SETTINGS[l].basePath}/${file}`;

  for (const locale of locales) {
    const settings = LOCALE_SETTINGS[locale];
    const files = pages.get(locale)!;
    if (!files.size) problems.push(`${locale}: ページがありません`);
    for (const file of files) {
      const where = `${settings.basePath || ''}/${file}`;
      const html = readFileSync(join(out, dirOf(locale), file), 'utf8');
      if (attr(html, /<html\b[^>]*\blang="([^"]+)"/) !== settings.language)
        problems.push(`${where}: <html lang> が ${settings.language} ではありません`);
      if (file === '404.html') continue;
      if (attr(html, /<link rel="canonical" href="([^"]+)"/) !== url(locale, file))
        problems.push(`${where}: canonical が ${url(locale, file)} ではありません`);
      if (attr(html, /<meta property="og:locale" content="([^"]+)"/) !== settings.openGraph)
        problems.push(`${where}: og:locale が ${settings.openGraph} ではありません`);
      const og = attr(html, /<meta property="og:image" content="([^"]+)"/);
      const ogPath = og?.startsWith(`https://${domain}/`)
        ? og.slice(`https://${domain}`.length)
        : null;
      if (!ogPath || !existsSync(join(out, ogPath)))
        problems.push(`${where}: OGP 画像がありません: ${og}（npm run og で言語ごとに作る）`);
      if (!sitemap.includes(`<loc>${url(locale, file)}</loc>`))
        problems.push(`${where}: sitemap.xml に載っていません`);

      if (locales.length > 1) {
        for (const other of [...locales, 'x-default' as const]) {
          const target = other === 'x-default' ? locales[0]! : other;
          const lang = other === 'x-default' ? other : LOCALE_SETTINGS[other].language;
          const href = attr(
            html,
            new RegExp(`<link rel="alternate" hrefLang="${lang}" href="([^"]+)"`, 'i'),
          );
          if (href !== url(target, file))
            problems.push(`${where}: hreflang="${lang}" が ${url(target, file)} を指していません`);
          if (!pages.get(target)!.has(file))
            problems.push(`${where}: 対応する ${target} のページがありません`);
        }
      }

      const switched = new Set<string>();
      for (const [tag = '', href = ''] of html.matchAll(
        /<a\b[^>]*\bhref="([^"#?]+\.html)(?:[#?][^"]*)?"[^>]*>/g,
      )) {
        if (!href.startsWith('/')) continue;
        // 言語の切り替え（hreflang 付き）は、別の言語の同じページだけを指してよい
        const switchTo = /\bhreflang="([^"]+)"/i.exec(tag)?.[1];
        if (switchTo) {
          const target = locales.find((l) => LOCALE_SETTINGS[l].language === switchTo);
          if (!target || href !== `${LOCALE_SETTINGS[target].basePath}/${file}`)
            problems.push(`${where}: 言語の切り替えが同じページを指していません: ${href}`);
          else switched.add(target);
          continue;
        }
        const prefix = `${settings.basePath}/`;
        if (!href.startsWith(prefix) || (!settings.basePath && otherDirs.has(href.split('/')[1]!)))
          problems.push(`${where}: 別の言語へのリンクがあります: ${href}`);
        else if (!existsSync(join(out, href.slice(1))))
          problems.push(`${where}: リンク先がありません: ${href}`);
      }
      if (locales.length > 1)
        for (const other of locales)
          if (other !== locale && !switched.has(other))
            problems.push(`${where}: ${other} への言語の切り替えがありません`);

      if (locale !== 'ja') {
        let text = visibleText(html, settings.language);
        for (const allowed of options.allowedJapanese ?? []) text = text.replaceAll(allowed, ' ');
        const mixed = text.match(new RegExp(`.{0,12}${JAPANESE.source}.{0,12}`, 'u'));
        if (mixed) problems.push(`${where}: 日本語の文字が混ざっています: 「${mixed[0].trim()}」`);
      }
    }
  }
  return problems;
}

if (process.argv[1]?.endsWith('check-locales.ts')) {
  const allowed = process.env.LOCALE_ALLOWED_JAPANESE?.split('|').filter(Boolean) ?? [];
  const problems = checkLocales({
    out: join(ROOT, 'out'),
    domain: DOMAIN,
    locales: PUBLISHED_LOCALES,
    allowedJapanese: allowed,
  });
  if (problems.length) {
    console.error(`check-locales: ${problems.length} 件\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`check-locales: ${PUBLISHED_LOCALES.join('・')} の出力を確認しました`);
}
