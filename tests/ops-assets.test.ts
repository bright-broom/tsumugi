import { describe, expect, it } from 'vitest';
import { checkReferencedAssets } from '../tools/ops/asset-checks';
import { inspectHtml } from '../tools/ops/html';
import { createProbe, type Fetch } from '../tools/ops/probe';

const ORIGIN = 'https://site.test';
const html = '<link rel="stylesheet" href="../theme.css?v=1"><img src="../hero.png">';
const pages = (markup: string) => [
  { url: `${ORIGIN}/nested/page.html`, facts: inspectHtml(markup) },
];

describe('HTMLが直接参照する資産の監視', () => {
  it('相対URL・クエリを保ち、重複・フラグメントをまとめてHEADだけで検査する', async () => {
    const calls: string[] = [];
    const fetch: Fetch = async (url, init) => {
      calls.push(url);
      expect(init?.method).toBe('HEAD');
      expect(init?.redirect).toBe('manual');
      expect(init?.signal).toBeDefined();
      return new Response('unused body', {
        headers: { 'content-type': url.includes('.css') ? 'text/css; charset=utf-8' : 'image/png' },
      });
    };
    const result = await checkReferencedAssets(
      pages(html + '<img src="../hero.png#one">'),
      createProbe({ fetch }),
    );
    expect(result.status).toBe('PASS');
    expect(calls.sort()).toEqual([`${ORIGIN}/hero.png`, `${ORIGIN}/theme.css?v=1`]);
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
    expect(calls).toHaveLength(2);
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
