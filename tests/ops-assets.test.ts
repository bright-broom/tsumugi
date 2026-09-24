import { describe, expect, it } from 'vitest';
import { checkReferencedAssets, cssReferences } from '../tools/ops/asset-checks';
import { inspectHtml } from '../tools/ops/html';
import { createProbe, type Fetch } from '../tools/ops/probe';

const ORIGIN = 'https://site.test';
const html = '<link rel="stylesheet" href="../theme.css?v=1"><img src="../hero.png">';
const pages = (markup: string) => [
  { url: `${ORIGIN}/nested/page.html`, facts: inspectHtml(markup) },
];

describe('HTMLが直接参照する資産の監視', () => {
  it('相対URL・クエリを保ち、重複・フラグメントをまとめる。資産は HEAD、CSS は中身も読む', async () => {
    const calls: string[] = [];
    const fetch: Fetch = async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      const css = url.includes('.css');
      expect(init?.redirect).toBe('manual');
      expect(init?.signal).toBeDefined();
      return new Response(css ? 'body{color:#000}' : 'unused body', {
        headers: { 'content-type': css ? 'text/css; charset=utf-8' : 'image/png' },
      });
    };
    const result = await checkReferencedAssets(
      pages(html + '<img src="../hero.png#one">'),
      createProbe({ fetch }),
    );
    expect(result.status).toBe('PASS');
    // 直接参照の確認は HEAD だけ。CSS だけは中の url() をたどるために GET する
    expect(calls.sort()).toEqual([
      `GET ${ORIGIN}/theme.css?v=1`,
      `HEAD ${ORIGIN}/hero.png`,
      `HEAD ${ORIGIN}/theme.css?v=1`,
    ]);
  });

  it.each([404, 503, 302, 405])('画像が%sなら失敗する', async (status) => {
    const result = await checkReferencedAssets(
      pages('<img src="/hero.png">'),
      createProbe({
        fetch: async () =>
          new Response(null, { status, headers: { location: 'https://other.test/' } }),
      }),
    );
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain(`HEAD ${status}`);
  });

  it.each(['text/html', 'application/octet-stream', ''])(
    '200の代替HTMLや誤った種類を成功にしない: %s',
    async (mime) => {
      const result = await checkReferencedAssets(
        pages(html),
        createProbe({
          fetch: async () => new Response(null, { headers: mime ? { 'content-type': mime } : {} }),
        }),
      );
      expect(result.status).toBe('FAIL');
      expect(result.detail).toContain('2件の不備');
    },
  );

  it('通信失敗でも他の資産を検査し、外部・data・templateは取得しない', async () => {
    const calls: string[] = [];
    const result = await checkReferencedAssets(
      pages(
        html +
          '<img src="https://outside.test/image.png"><img src="data:image/png;base64,AAA"><template><img src="/inert.png"></template>',
      ),
      createProbe({
        fetch: async (url) => {
          calls.push(url);
          if (url.includes('hero')) throw new Error('timeout');
          return new Response(null, { headers: { 'content-type': 'text/css' } });
        },
      }),
    );
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain('HEAD取得失敗');
    // theme.css は HEAD のあと、中身をたどるために GET する
    expect(calls).toEqual([
      `${ORIGIN}/theme.css?v=1`,
      `${ORIGIN}/hero.png`,
      `${ORIGIN}/theme.css?v=1`,
    ]);
  });

  it('OGP画像・アイコン・空URLと認証付きURLを扱う', async () => {
    const calls: string[] = [];
    const markup =
      '<meta property="og:image" content="/og.png"><link rel="icon" href="/icon.svg"><img src=""><img src="https://user:pass@site.test/private.png">';
    const result = await checkReferencedAssets(
      pages(markup),
      createProbe({
        fetch: async (url) => {
          calls.push(url);
          return new Response(null, { headers: { 'content-type': 'image/png' } });
        },
      }),
    );
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain('認証情報付き');
    expect(calls.sort()).toEqual([`${ORIGIN}/icon.svg`, `${ORIGIN}/og.png`]);
  });

  it('同じURLをCSSと画像として参照する誤りも検出する', async () => {
    const result = await checkReferencedAssets(
      pages('<img src="/same"><link rel="stylesheet" href="/same">'),
      createProbe({
        fetch: async () => new Response(null, { headers: { 'content-type': 'image/png' } }),
      }),
    );
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain('cssのContent-Type');
  });

  it('取得可能なページや資産がなければ合格にしない', async () => {
    const probe = createProbe({
      fetch: async () => {
        throw new Error('must not call');
      },
    });
    expect((await checkReferencedAssets([], probe)).status).toBe('FAIL');
    expect(
      (await checkReferencedAssets(pages('<img src="data:image/png;base64,AAA">'), probe)).status,
    ).toBe('FAIL');
  });

  it('上限超過は資産への通信前に拒否する', async () => {
    let calls = 0;
    const markup = Array.from({ length: 129 }, (_, i) => `<img src="/${i}.png">`).join('');
    const result = await checkReferencedAssets(
      pages(markup),
      createProbe({
        fetch: async () => {
          calls++;
          return new Response();
        },
      }),
    );
    expect(result.status).toBe('FAIL');
    expect(calls).toBe(0);
  });

  it('最大4並列に制限する', async () => {
    let active = 0,
      max = 0;
    const markup = Array.from({ length: 12 }, (_, i) => `<img src="/${i}.png">`).join('');
    const result = await checkReferencedAssets(
      pages(markup),
      createProbe({
        fetch: async () => {
          active++;
          max = Math.max(max, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active--;
          return new Response(null, { headers: { 'content-type': 'image/png' } });
        },
      }),
    );
    expect(result.status).toBe('PASS');
    expect(max).toBe(4);
  });
});

describe('CSS の中から参照される資産の監視', () => {
  /** theme.css が font/background を指す配信を模す。 */
  const serve = (files: Record<string, { status?: number; type?: string; body?: string }>) => {
    const calls: string[] = [];
    const probe = createProbe({
      fetch: async (url, init) => {
        calls.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}`);
        const file = files[new URL(url).pathname];
        if (!file) return new Response(null, { status: 404 });
        return new Response(file.body ?? '', {
          status: file.status ?? 200,
          headers: { 'content-type': file.type ?? 'text/css' },
        });
      },
    });
    return { calls, probe };
  };
  const cssPage = [
    {
      url: `${ORIGIN}/index.html`,
      facts: inspectHtml('<link rel="stylesheet" href="/theme.css">'),
    },
  ];

  it('url() が指す書体を取りに行き、配信されていれば合格にする', async () => {
    const { calls, probe } = serve({
      '/theme.css': { body: "@font-face{src:url('fonts/league-gothic.woff2') format('woff2')}" },
      '/fonts/league-gothic.woff2': { type: 'font/woff2' },
    });
    const result = await checkReferencedAssets(cssPage, probe);
    expect(result.status).toBe('PASS');
    expect(result.detail).toContain('CSS内の1参照');
    expect(calls).toContain('HEAD /fonts/league-gothic.woff2');
  });

  it('CSS の中だけから参照される書体の欠落を見つける', async () => {
    const { probe } = serve({
      '/theme.css': { body: 'body{background:url("/images/hero.webp")}' },
    });
    const result = await checkReferencedAssets(cssPage, probe);
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain('/theme.css → /images/hero.webp');
    expect(result.detail).toContain('HEAD 404');
  });

  it('無いファイルに HTML を返す配信も失敗にする', async () => {
    const { probe } = serve({
      '/theme.css': { body: 'body{background:url(/images/hero.webp)}' },
      '/images/hero.webp': { type: 'text/html; charset=utf-8' },
    });
    const result = await checkReferencedAssets(cssPage, probe);
    expect(result.status).toBe('FAIL');
    expect(result.detail).toContain('HTML が返る');
  });

  it('@import の先の CSS もたどる', async () => {
    const { calls, probe } = serve({
      '/theme.css': { body: '@import "parts/print.css";' },
      '/parts/print.css': { body: 'body{background:url(/paper.png)}' },
      '/paper.png': { type: 'image/png' },
    });
    const result = await checkReferencedAssets(cssPage, probe);
    expect(result.status).toBe('PASS');
    expect(calls).toContain('GET /parts/print.css');
    expect(calls).toContain('HEAD /paper.png');
  });

  it('参照の抜き出しは、コメント・data:・外部サイト・重複を除く', () => {
    const css = [
      '/* url(/commented.png) */',
      "@font-face{src:url('/a.woff2')}",
      'a{background:url(/a.woff2)}',
      'b{background:url("https://cdn.example/b.png")}',
      'c{background:url(data:image/png;base64,AAA)}',
      '@import url(/d.css);',
    ].join('\n');
    expect(cssReferences(css, `${ORIGIN}/theme.css`)).toEqual([
      `${ORIGIN}/a.woff2`,
      `${ORIGIN}/d.css`,
    ]);
  });
});
