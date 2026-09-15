import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectHtml } from '../tools/ops/html';
import { createProbe, distFetch, type Certificate, type Fetch } from '../tools/ops/probe';
import { tally, type CheckResult } from '../tools/ops/results';
import { checkLive, parseSiteUrl } from '../tools/ops/site-checks';

const ORIGIN = 'https://tsumugi.test';
const NOW = new Date('2026-09-16T00:00:00Z');
const POLICY = { warnDays: 21, failDays: 7, now: NOW };
const FILES = ['index.html', 'price.html', 'terms.html'];

const page = (file: string, extra = '') =>
  '<!doctype html><html lang="ja"><head><title>紬</title>' +
  `<link rel="canonical" href="${ORIGIN}/${file}">` +
  `<meta property="og:url" content="${ORIGIN}/${file}">` +
  '<script type="application/ld+json">{"@context":"https://schema.org"}</script>' +
  `</head><body><main>本文</main>${extra}</body></html>`;

type Routes = Record<string, { status: number; body?: string; location?: string }>;

function healthySite(): Routes {
  const routes: Routes = {
    'http://tsumugi.test/': { status: 308, location: `${ORIGIN}/` },
    [`${ORIGIN}/`]: { status: 200, body: page('index.html') },
    [`${ORIGIN}/robots.txt`]: {
      status: 200,
      body: `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`,
    },
    [`${ORIGIN}/sitemap.xml`]: {
      status: 200,
      body:
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        FILES.map((file) => `  <url><loc>${ORIGIN}/${file}</loc></url>\n`).join('') +
        '</urlset>\n',
    },
  };
  for (const file of FILES) routes[`${ORIGIN}/${file}`] = { status: 200, body: page(file) };
  return routes;
}

/** fetch の代わり。ルートに無い URL は静的ホスティングと同じく 404 を返す。 */
const mockFetch =
  (routes: Routes): Fetch =>
  async (url) => {
    const route = routes[url] ?? { status: 404, body: 'not found' };
    const headers = new Headers(route.location ? { location: route.location } : {});
    return new Response(route.body ?? null, { status: route.status, headers });
  };

const validCertificate: Certificate = {
  authorized: true,
  error: null,
  validTo: new Date('2026-12-01T00:00:00Z'),
  issuer: 'Test CA',
};

function probeFor(routes: Routes, certificate: Partial<Certificate> = {}) {
  return createProbe({
    fetch: mockFetch(routes),
    resolveHost: async () => ['192.0.2.10'],
    certificate: async () => ({ ...validCertificate, ...certificate }),
  });
}

const named = (results: CheckResult[], name: string) => {
  const found = results.find((entry) => entry.name.startsWith(name));
  if (!found) throw new Error(`${name} の結果がない`);
  return found;
};

describe('公開後の確認（check:live）', () => {
  it('正しく公開されたサイトは FAIL も WARN も出さない', async () => {
    const results = await checkLive(parseSiteUrl(ORIGIN), probeFor(healthySite()), POLICY);
    expect(results.filter((entry) => entry.status !== 'PASS')).toEqual([]);
    expect(named(results, 'sitemap 掲載 URL').detail).toContain('3 件すべて 200');
    expect(named(results, 'HTTPS の証明書').detail).toContain('残り 76 日');
  });

  it('canonical と og:url がほかのドメインを指すページを挙げる', async () => {
    const routes = healthySite();
    routes[`${ORIGIN}/price.html`] = {
      status: 200,
      body: page('price.html').replaceAll(`${ORIGIN}/price.html`, 'https://example.jp/price.html'),
    };
    const results = await checkLive(parseSiteUrl(ORIGIN), probeFor(routes), POLICY);
    expect(named(results, 'canonical').status).toBe('FAIL');
    expect(named(results, 'canonical').detail).toContain(
      '/price.html: https://example.jp/price.html',
    );
    expect(named(results, 'og:url').status).toBe('FAIL');
  });

  it('配信側で挿入された script とイベント属性を FAIL にする', async () => {
    const routes = healthySite();
    routes[`${ORIGIN}/terms.html`] = {
      status: 200,
      body: page(
        'terms.html',
        '<script src="/_vercel/insights/script.js"></script><a onclick="x()">x</a>',
      ),
    };
    const result = named(await checkLive(parseSiteUrl(ORIGIN), probeFor(routes), POLICY), '実行時');
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain('/terms.html: /_vercel/insights/script.js');
    expect(result.detail).toContain('/terms.html: <a onclick>');
  });

  it('存在しない URL が 200 を返す（ソフト 404）と FAIL', async () => {
    const soft: Fetch = async (url) =>
      healthySite()[url] ? mockFetch(healthySite())(url) : new Response(page('index.html'));
    const probe = createProbe({
      fetch: soft,
      resolveHost: async () => ['192.0.2.10'],
      certificate: async () => validCertificate,
    });
    const result = named(await checkLive(parseSiteUrl(ORIGIN), probe, POLICY), '存在しない URL');
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain('→ 200');
  });

  it('sitemap の URL が 200 でない・転送される場合を挙げる', async () => {
    const routes = healthySite();
    routes[`${ORIGIN}/price.html`] = { status: 500, body: 'error' };
    routes[`${ORIGIN}/terms.html`] = { status: 301, location: `${ORIGIN}/terms` };
    const result = named(
      await checkLive(parseSiteUrl(ORIGIN), probeFor(routes), POLICY),
      'sitemap 掲載',
    );
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain('/price.html → 500');
    expect(result.detail).toContain('/terms.html → 301');
  });

  it('robots.txt の全体拒否と、ほかのドメインの Sitemap を FAIL にする', async () => {
    const routes = healthySite();
    routes[`${ORIGIN}/robots.txt`] = {
      status: 200,
      body: 'User-agent: *\nDisallow: /\nSitemap: https://example.jp/sitemap.xml\n',
    };
    const result = named(await checkLive(parseSiteUrl(ORIGIN), probeFor(routes), POLICY), 'robots');
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain('Disallow: /');
    expect(result.detail).toContain('https://example.jp/sitemap.xml');
  });

  it('ほかの User-agent 向けの Disallow: / は全体拒否と数えない', async () => {
    const routes = healthySite();
    routes[`${ORIGIN}/robots.txt`] = {
      status: 200,
      body: `User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`,
    };
    const result = named(await checkLive(parseSiteUrl(ORIGIN), probeFor(routes), POLICY), 'robots');
    expect(result.status).toBe('PASS');
  });

  it.each([
    [{ validTo: new Date('2026-10-01T00:00:00Z') }, 'WARN', '残り 15 日'],
    [{ validTo: new Date('2026-09-20T00:00:00Z') }, 'FAIL', '残り 4 日'],
    [{ authorized: false, error: 'CERT_HAS_EXPIRED' }, 'FAIL', 'CERT_HAS_EXPIRED'],
  ] as const)('証明書の残り日数と検証エラーを判定する %#', async (certificate, status, text) => {
    const result = named(
      await checkLive(parseSiteUrl(ORIGIN), probeFor(healthySite(), certificate), POLICY),
      'HTTPS の証明書',
    );
    expect(result.status).toBe(status);
    expect(result.detail).toContain(text);
  });

  it('HTTP のまま配信していると FAIL、一時転送は WARN', async () => {
    const plain = healthySite();
    plain['http://tsumugi.test/'] = { status: 200, body: page('index.html') };
    expect(
      named(await checkLive(parseSiteUrl(ORIGIN), probeFor(plain), POLICY), 'HTTP から').status,
    ).toBe('FAIL');
    const temporary = healthySite();
    temporary['http://tsumugi.test/'] = { status: 302, location: `${ORIGIN}/` };
    expect(
      named(await checkLive(parseSiteUrl(ORIGIN), probeFor(temporary), POLICY), 'HTTP から').status,
    ).toBe('WARN');
  });

  it('名前解決も接続もできないときは例外で止まらず FAIL を並べる', async () => {
    const probe = createProbe({
      fetch: async () => {
        throw new TypeError('fetch failed', {
          cause: new Error('getaddrinfo ENOTFOUND tsumugi.test'),
        });
      },
      resolveHost: async () => {
        throw new Error('ENOTFOUND');
      },
      certificate: async () => {
        throw new Error('ENOTFOUND');
      },
    });
    const results = await checkLive(parseSiteUrl(ORIGIN), probe, POLICY);
    expect(tally(results).FAIL).toBeGreaterThanOrEqual(6);
    expect(named(results, 'トップページ').detail).toContain('ENOTFOUND');
  });

  it.each([
    'http://tsumugi.test',
    'https://tsumugi.test/price.html',
    'https://tsumugi.test:8443',
    'tsumugi.test',
  ])('ドメインのトップ以外の指定を拒否する: %s', (value) =>
    expect(() => parseSiteUrl(value)).toThrow(),
  );
});

describe('out/ を読む模擬配信（リハーサル）', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('ビルド出力と同じ構成なら通信せずに合格し、通信が要る項目は SKIP にする', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tsumugi-dist-'));
    for (const file of FILES) writeFileSync(join(dir, file), page(file));
    writeFileSync(join(dir, '404.html'), page('404.html'));
    writeFileSync(join(dir, 'robots.txt'), healthySite()[`${ORIGIN}/robots.txt`]!.body!);
    writeFileSync(join(dir, 'sitemap.xml'), healthySite()[`${ORIGIN}/sitemap.xml`]!.body!);
    const probe = createProbe({ fetch: distFetch(dir), network: false });
    const results = await checkLive(parseSiteUrl(ORIGIN), probe, POLICY);
    expect(tally(results)).toEqual({ PASS: 8, WARN: 0, FAIL: 0, SKIP: 3 });
  });

  it('ディレクトリの外は読まない', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tsumugi-dist-'));
    writeFileSync(join(dir, 'index.html'), page('index.html'));
    const response = await distFetch(join(dir))(`${ORIGIN}/%2e%2e/%2e%2e/package.json`);
    expect(response.status).toBe(404);
  });
});

describe('HTML から読む事実', () => {
  it('JSON-LD は実行時 JS に数えず、template の中の script は数える', () => {
    const facts = inspectHtml(
      '<script type="application/ld+json">{}</script><template><script>alert(1)</script></template>' +
        '<svg><rect onload="x()"/></svg>',
    );
    expect(facts.runtimeScripts).toEqual(['inline']);
    expect(facts.inlineHandlers).toEqual(['<rect onload>']);
  });
});
