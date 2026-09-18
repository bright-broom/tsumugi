import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sitemapXml } from '@/content/sitemap';
import { getMessages } from '@/i18n/catalog';
import { localePath, parseLocale } from '@/lib/locale';
import { assertCollectionBase } from '@/routing/collections';
import { ROUTES, canonical, ogImage } from '@/routing/registry';
import { localeHtmlFiles } from '../tools/scripts/build-locales';
import { checkLocales } from '../tools/scripts/check-locales';

const D = 'example.jp';

describe('言語ごとのパスと URL', () => {
  it('既定言語はルート直下、追加言語はその言語のパスの下', () => {
    expect(localePath('price.html')).toBe('/price.html');
    expect(localePath('news/a.html', 'en')).toBe('/en/news/a.html');
    expect(ROUTES.price.path).toBe('/price.html');
    expect(canonical(D, 'price.html', 'en')).toBe('https://example.jp/en/price.html');
    expect(ogImage(D, 'price.html')).toBe('https://example.jp/og/price.png');
    expect(ogImage(D, 'price.html', 'en')).toBe('https://example.jp/og/en/price.png');
  });

  it('翻訳カタログのない言語・未対応の言語は、日本語で代用せずに止める', () => {
    expect(() => getMessages('en')).toThrow('No catalog for locale: en');
    expect(() => getMessages('fr')).toThrow('Unsupported locale: fr');
    expect(() => parseLocale('xx')).toThrow();
    expect(() => sitemapXml(undefined, D, ['ja', 'en'])).toThrow('No catalog');
    expect(sitemapXml(undefined, D, ['ja'])).toBe(sitemapXml(undefined, D));
  });

  it('言語のディレクトリ名はコレクションに使えない', () => {
    expect(() => assertCollectionBase('en', null)).toThrow('Invalid collection base');
  });
});

describe('多言語の出力の検査', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  const page = (
    lang: 'ja' | 'en',
    file: string,
    body: string,
    change: (h: string) => string = (h) => h,
  ) => {
    const url = (l: 'ja' | 'en') => `https://${D}${l === 'en' ? '/en' : ''}/${file}`;
    const name = file.replace(/\.html$/, '');
    return change(`<!DOCTYPE html><html lang="${lang}"><head>
<link rel="canonical" href="${url(lang)}"/>
<link rel="alternate" hrefLang="ja" href="${url('ja')}"/>
<link rel="alternate" hrefLang="en" href="${url('en')}"/>
<link rel="alternate" hrefLang="x-default" href="${url('ja')}"/>
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ja_JP'}"/>
<meta property="og:image" content="https://${D}/og/${lang === 'en' ? 'en/' : ''}${name}.png"/>
</head><body><main>${body}</main></body></html>`);
  };

  function site(changeEn: (h: string) => string = (h) => h) {
    const out = mkdtempSync(join(tmpdir(), 'locales-'));
    dirs.push(out);
    const write = (path: string, text: string) => {
      mkdirSync(dirname(join(out, path)), { recursive: true });
      writeFileSync(join(out, path), text);
    };
    for (const file of ['index.html', 'price.html']) {
      const other = file === 'index.html' ? 'price.html' : 'index.html';
      write(
        file,
        page(
          'ja',
          file,
          `<p>料金</p><a href="/${other}">次へ</a><a href="/en/${file}" hrefLang="en" lang="en">English</a>`,
        ),
      );
      write(
        `en/${file}`,
        page(
          'en',
          file,
          `<p>Pricing</p><a href="/en/${other}#top">Next</a><a href="/${file}" hrefLang="ja" lang="ja">日本語</a>`,
          changeEn,
        ),
      );
      write(`og/${file.replace('.html', '.png')}`, '');
      write(`og/en/${file.replace('.html', '.png')}`, '');
    }
    write(
      'sitemap.xml',
      ['', '/en']
        .flatMap((b) => ['index', 'price'].map((p) => `<loc>https://${D}${b}/${p}.html</loc>`))
        .join(''),
    );
    return out;
  }
  const check = (out: string, allowedJapanese: string[] = []) =>
    checkLocales({ out, domain: D, locales: ['ja', 'en'], allowedJapanese });

  it('言語・canonical・相互の hreflang・同じ言語内のリンク・画像・サイトマップが揃えば合格', () => {
    expect(check(site())).toEqual([]);
  });

  it('日本語の混入は許可した固有名詞を除いて検出する', () => {
    const out = site((h) => h.replace('<p>Pricing</p>', '<p>Pricing 紬 料金</p>'));
    expect(check(out).join('\n')).toContain('日本語の文字が混ざっています');
    expect(check(out, ['紬', '料金'])).toEqual([]);
  });

  it.each([
    [
      '別の言語へのリンク',
      (h: string) => h.replace('href="/en/index.html', 'href="/index.html'),
      '別の言語へのリンク',
    ],
    ['lang の誤り', (h: string) => h.replace('lang="en"', 'lang="ja"'), '<html lang>'],
    [
      'hreflang の欠落',
      (h: string) => h.replace(/<link rel="alternate" hrefLang="x-default"[^>]*>/, ''),
      'x-default',
    ],
    [
      'canonical の誤り',
      (h: string) =>
        h.replace(
          `https://${D}/en/price.html"/>\n<link rel="alternate" hrefLang="ja"`,
          `https://${D}/price.html"/>\n<link rel="alternate" hrefLang="ja"`,
        ),
      'canonical',
    ],
    ['OGP 画像の欠落', (h: string) => h.replace('/og/en/', '/og/fr/'), 'OGP 画像がありません'],
    [
      '言語の切り替えの欠落',
      (h: string) => h.replace(/<a href="\/[a-z]+\.html" hrefLang="ja"[^>]*>[^<]*<\/a>/, ''),
      'ja への言語の切り替えがありません',
    ],
    [
      '別のページへの切り替え',
      (h: string) =>
        h.replace(/href="\/([a-z]+)\.html" hrefLang="ja"/, 'href="/other.html" hrefLang="ja"'),
      '同じページを指していません',
    ],
  ])('%s を検出する', (_, change, message) => {
    expect(check(site(change)).join('\n')).toContain(message);
  });

  it('対応する言語のページがなければ検出する', () => {
    const out = site();
    rmSync(join(out, 'en', 'price.html'));
    const problems = check(out).join('\n');
    expect(problems).toContain('/price.html: 対応する en のページがありません');
    expect(problems).toContain('リンク先がありません: /en/price.html');
  });

  it('ビルドの作業用ディレクトリの HTML は統合しない', () => {
    const out = site();
    mkdirSync(join(out, 'server'), { recursive: true });
    writeFileSync(join(out, 'server', 'x.html'), '');
    expect(localeHtmlFiles(out)).not.toContain('server/x.html');
    expect(localeHtmlFiles(out)).toContain('en/price.html');
  });
});

describe('翻訳カタログの突き合わせ', () => {
  const ja = {
    a: '料金は {price} 円',
    b: ['一', '二'],
    c: { d: '<a href="@route:price">料金</a>' },
  };
  it('キー・配列の長さ・差し込み値・リンク先が同じなら合格', async () => {
    const { compareCatalogs } = await import('@/i18n/locales');
    expect(
      compareCatalogs(ja, {
        a: 'Price {price} yen',
        b: ['one', 'two'],
        c: { d: '<a href="@route:price">Price</a>' },
      }),
    ).toEqual([]);
  });
  it('欠け・余り・長さ・差し込み値・リンク先の違いを示す', async () => {
    const { compareCatalogs } = await import('@/i18n/locales');
    const problems = compareCatalogs(ja, {
      a: 'Price {amount}',
      b: ['one'],
      c: { d: '<a href="@route:faq">x</a>', e: 'extra' },
    });
    expect(problems.join('\n')).toMatch(/a: placeholders differ/);
    expect(problems.join('\n')).toMatch(/b: list has 1 items, expected 2/);
    expect(problems.join('\n')).toMatch(/c\.d: placeholders differ/);
    expect(problems.join('\n')).toMatch(/c\.e: not in the Japanese catalog/);
    expect(compareCatalogs(ja, { b: ['one', 'two'], c: {} }).join('\n')).toMatch(
      /a: text is missing/,
    );
  });
  it('日本語のカタログを疑似翻訳したものは、登録できる', async () => {
    const { translated } = await import('@/i18n/locales');
    const { ja: source } = await import('@/i18n/locales/ja');
    const pseudo = (v: unknown): unknown =>
      typeof v === 'string'
        ? v.replace(/[　-ヿ㐀-鿿＀-￯]+/gu, 'Ps')
        : Array.isArray(v)
          ? v.map(pseudo)
          : v && typeof v === 'object'
            ? Object.fromEntries(Object.entries(v).map(([k, c]) => [k, pseudo(c)]))
            : v;
    expect(() => translated('en', pseudo(source) as never)).not.toThrow();
    expect(() => translated('en', { ...(pseudo(source) as object), extra: 'x' } as never)).toThrow(
      'does not match ja',
    );
  });
});

describe('言語の切り替えと検査の範囲', () => {
  it('1言語のサイトでは切り替えを出さない', async () => {
    const { languageLinks } = await import('@/content/languages');
    expect(languageLinks('price.html')).toEqual([]);
    expect(() => languageLinks('price.html', ['ja', 'en'])).toThrow('No catalog');
  });
  it('既定言語の検査はサイトの起点から集め、公開していない言語名のディレクトリは通常のページとして扱う', async () => {
    const { localeScope } = await import('../tools/verify/static');
    const out = mkdtempSync(join(tmpdir(), 'scope-'));
    mkdirSync(join(out, 'en'), { recursive: true });
    writeFileSync(join(out, 'index.html'), '');
    writeFileSync(join(out, 'en', 'index.html'), '');
    const scope = localeScope(out);
    expect(scope).toMatchObject({ root: out, urlPrefix: '' });
    expect(scope.files).toEqual(['en/index.html', 'index.html']);
    rmSync(out, { recursive: true, force: true });
  });
});
