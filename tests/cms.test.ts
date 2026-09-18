import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { reviewCollections } from '@/content/collections';
import { getMessages } from '@/i18n/catalog';
import { CmsError } from '../tools/cms/microcms';
import { pullCms } from '../tools/cms/pull';

const SERVICE = 'sample-service';
const ENV = { CMS_SOURCE: 'microcms', MICROCMS_SERVICE_DOMAIN: SERVICE, MICROCMS_API_KEY: 'key' };
const WEBP = new Uint8Array(
  [...'RIFF']
    .map((c) => c.charCodeAt(0))
    .concat(
      [0, 0, 0, 0],
      [...'WEBPVP8 '].map((c) => c.charCodeAt(0)),
    ),
);
const asset = (name: string) => ({
  url: `https://images.microcms-assets.io/assets/abc/${name}.jpg`,
  width: 3200,
  height: 1800,
});

const article = (n: number, change: Record<string, unknown> = {}) => ({
  id: `a${n}`,
  slug: `sample-article-${n}`,
  kind: ['column'],
  title: `サンプル記事 ${n}`,
  date: '2026-09-18T16:00:00.000Z',
  publishedAt: '2026-09-17T01:00:00.000Z',
  revisedAt: '2026-09-19T01:00:00.000Z',
  seoDescription:
    'サンプルの説明文です。架空の記事で、取り込みと公開前チェックの確認だけに使います。',
  image: asset(`main-${n}`),
  imageAlt: 'サンプル画像',
  body: [
    { fieldId: 'heading', text: '見出し' },
    { fieldId: 'paragraph', text: '本文の段落です。' },
    { fieldId: 'list', items: '一つ目\n\n二つ目\r\n' },
    { fieldId: 'image', image: asset(`body-${n}`), alt: '本文の画像', caption: null },
  ],
  ...change,
});

function setup(
  contents: { articles: unknown[]; cases?: unknown[] },
  overrides: Record<number, Response> = {},
) {
  const dir = mkdtempSync(join(tmpdir(), 'cms-pull-'));
  const calls: string[] = [];
  let apiCall = 0;
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('https://images.microcms-assets.io/'))
      return new Response(WEBP, { headers: { 'content-type': 'image/webp' } });
    expect(new Headers(init?.headers).get('X-MICROCMS-API-KEY')).toBe('key');
    apiCall++;
    if (overrides[apiCall]) return overrides[apiCall]!;
    const { pathname, searchParams } = new URL(url);
    const list = pathname.endsWith('/articles') ? contents.articles : (contents.cases ?? []);
    const offset = Number(searchParams.get('offset'));
    const limit = Number(searchParams.get('limit'));
    return Response.json({
      contents: list.slice(offset, offset + limit),
      totalCount: list.length,
      offset,
      limit,
    });
  }) as typeof globalThis.fetch;
  const options = {
    env: ENV,
    fetch,
    retryDelayMs: 0,
    snapshotFile: join(dir, 'cms.json'),
    imageDirectory: join(dir, 'images'),
    now: () => new Date('2026-09-19T00:00:00.000Z'),
  };
  return { dir, calls, options };
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('microCMS の取り込み', () => {
  it('公開済みの記事を型付きのブロックへ変換し、画像を WebP で自サイトへ取り込む', async () => {
    const s = setup({ articles: Array.from({ length: 101 }, (_, i) => article(i + 1)) });
    dirs.push(s.dir);
    writeFileSync(join(s.dir, 'stale.webp'), '');
    const summary = await pullCms(s.options);
    expect(summary).toMatchObject({
      articles: 101,
      cases: 0,
      images: { total: 202, downloaded: 202 },
    });
    expect(s.calls.filter((c) => c.includes('/api/v1/articles'))).toHaveLength(2);

    const snapshot = JSON.parse(readFileSync(s.options.snapshotFile, 'utf8'));
    expect(snapshot.pulledFrom).toEqual({ service: SERVICE, at: '2026-09-19T00:00:00.000Z' });
    const first = snapshot.articles.find((a: { slug: string }) => a.slug === 'sample-article-1');
    expect(first).toMatchObject({
      status: 'published',
      kind: 'column',
      publishedAt: '2026-09-19',
      updatedAt: '2026-09-19',
      seo: { title: 'サンプル記事 1' },
      image: { alt: 'サンプル画像', width: 1600, height: 900 },
    });
    expect(first.image.src).toMatch(/^\/images\/cms\/[0-9a-f]{20}\.webp$/);
    expect(first.body.map((b: { type: string }) => b.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'image',
    ]);
    expect(first.body[2].items).toEqual(['一つ目', '二つ目']);
    expect(JSON.stringify(snapshot)).not.toMatch(/microcms-assets|<[a-z]/i);
    const imageCall = s.calls.find((c) => c.includes('main-1.jpg'))!;
    expect(new URL(imageCall).searchParams.get('fm')).toBe('webp');
    expect(new URL(imageCall).searchParams.get('w')).toBe('1600');
    expect(readdirSync(join(s.dir, 'images'))).toHaveLength(202);

    // 取り込んだ記事は、サイトの公開前チェックと公開の対象になる
    const review = reviewCollections({
      ...getMessages().entries,
      articles: { entries: snapshot.articles },
    });
    expect(review.problems).toEqual([]);
    expect(review.site.articles.published).toHaveLength(101);
  });

  it('公開前チェックに通らない記事があれば、何も書き出さずに止める', async () => {
    const s = setup({ articles: [article(1, { seoDescription: '短い' })] });
    dirs.push(s.dir);
    await expect(pullCms(s.options)).rejects.toThrow(/sample-article-1: .*description/);
    expect(existsSync(s.options.snapshotFile)).toBe(false);
    expect(existsSync(join(s.dir, 'images'))).toBe(false);
  });

  it('HTML の本文・外部の画像・種類の未選択は受け付けない', async () => {
    for (const bad of [
      article(1, { body: [{ fieldId: 'richEditor', html: '<script>alert(1)</script>' }] }),
      article(1, { image: { url: 'https://evil.example/x.jpg', width: 10, height: 10 } }),
      article(1, { kind: [] }),
    ]) {
      const s = setup({ articles: [bad] });
      dirs.push(s.dir);
      await expect(pullCms(s.options)).rejects.toBeInstanceOf(CmsError);
      expect(existsSync(s.options.snapshotFile)).toBe(false);
    }
  });

  it('事例は、リポジトリの分類にない業種を公開しない', async () => {
    const s = setup({
      articles: [],
      cases: [
        {
          ...article(1),
          slug: 'sample-case-1',
          industry: 'unknown-industry',
          categories: ['x'],
          summary: '概要',
          fields: [{ fieldId: 'field', key: 'period', value: '3 か月' }],
          gallery: [{ fieldId: 'photo', image: asset('g1'), alt: '写真' }],
        },
      ],
    });
    dirs.push(s.dir);
    await expect(pullCms(s.options)).rejects.toThrow(/sample-case-1: industry "unknown-industry"/);
  });

  it('一時的な障害は再試行し、認証の誤りや設定の不足で止まる', async () => {
    const retry = setup({ articles: [article(1)] }, { 1: new Response('', { status: 429 }) });
    dirs.push(retry.dir);
    expect((await pullCms(retry.options)).articles).toBe(1);

    const denied = setup(
      { articles: [] },
      { 1: new Response('', { status: 401 }), 2: new Response('', { status: 401 }) },
    );
    dirs.push(denied.dir);
    await expect(pullCms(denied.options)).rejects.toThrow('HTTP 401');

    await expect(
      pullCms({ ...denied.options, env: { ...ENV, MICROCMS_API_KEY: '' } }),
    ).rejects.toThrow('MICROCMS_API_KEY');
    await expect(
      pullCms({ ...denied.options, env: { ...ENV, MICROCMS_SERVICE_DOMAIN: 'bad domain' } }),
    ).rejects.toThrow('サービス ID');
    await expect(pullCms({ ...denied.options, env: {} })).rejects.toThrow('CMS_SOURCE');
  });
});
