/**
 * microCMS の公開済みの記事・事例を取り込み、スナップショットと画像を書き出す（ADR 0080）。
 *
 *     CMS_SOURCE=microcms MICROCMS_SERVICE_DOMAIN=<ID> MICROCMS_API_KEY=<鍵> npm run cms:pull
 *     npm run build   ビルドの最初に同じ処理を行う（CMS_SOURCE が未設定なら何もせずリポジトリのデータを使う）
 *
 * 取り込んだ内容は公開前チェック（content/collections.ts）を通してから書き出す。問題があればビルドを止め、
 * 公開中の版を残す。スナップショットは src/i18n/locales/ja/entries/cms.json、画像は public/images/cms/。
 * コミットしておけば、CMS が使えなくなっても同じ内容でサイトを作り直せる。
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { reviewCollections } from '@/content/collections';
import { getMessages } from '@/i18n/catalog';
import { ROOT } from '../paths';
import { CMS_IMAGE_DIR, downloadImages, planImages } from './images';
import { CMS_ENDPOINTS, CmsError, createCmsClient, mapArticles, mapCases } from './microcms';

type Fetch = typeof globalThis.fetch;

export interface PullOptions {
  env: Record<string, string | undefined>;
  snapshotFile?: string;
  imageDirectory?: string;
  fetch?: Fetch;
  retryDelayMs?: number;
  now?: () => Date;
}

export async function pullCms(options: PullOptions) {
  const { env } = options;
  if (env.CMS_SOURCE !== 'microcms')
    throw new CmsError(
      `CMS_SOURCE は microcms だけに対応しています（現在: ${env.CMS_SOURCE ?? '未設定'}）`,
    );
  const serviceDomain = env.MICROCMS_SERVICE_DOMAIN ?? '';
  const client = createCmsClient({
    serviceDomain,
    apiKey: env.MICROCMS_API_KEY ?? '',
    fetch: options.fetch,
    retryDelayMs: options.retryDelayMs,
  });
  const images = planImages();
  const articles = mapArticles(await client.listAll(CMS_ENDPOINTS.articles), images.resolve);
  const cases = mapCases(await client.listAll(CMS_ENDPOINTS.cases), images.resolve);

  // 公開前チェックは、リポジトリにある事例の分類・エリア・実績と合わせて行う。
  const current = getMessages().entries;
  const { problems } = reviewCollections({
    ...current,
    articles: { entries: articles },
    cases: { taxonomy: current.cases.taxonomy, entries: cases },
  });
  if (problems.length)
    throw new CmsError(
      `公開前チェックに通らないコンテンツがあります（公開中のサイトは変えません）:\n${problems
        .map((p) => `  ${p.collection}/${p.slug}: ${p.reason}`)
        .join('\n')}`,
    );

  const result = await downloadImages(
    images.planned,
    options.imageDirectory ?? join(ROOT, 'public', 'images', CMS_IMAGE_DIR),
    { fetch: options.fetch },
  );
  const bySlug = <T extends { slug: string }>(list: T[]) =>
    [...list].sort((a, b) => a.slug.localeCompare(b.slug));
  const snapshot = {
    pulledFrom: { service: serviceDomain, at: (options.now?.() ?? new Date()).toISOString() },
    articles: bySlug(articles),
    cases: bySlug(cases),
  };
  writeFileSync(
    options.snapshotFile ?? join(ROOT, 'src', 'i18n', 'locales', 'ja', 'entries', 'cms.json'),
    `${JSON.stringify(snapshot, null, 2)}\n`,
  );
  return { articles: articles.length, cases: cases.length, images: result };
}

const isMain = import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href;
if (isMain) {
  const ifConfigured = process.argv.includes('--if-configured');
  if (ifConfigured && !process.env.CMS_SOURCE) {
    // CMS を使わないサイト（紬の自社サイトを含む）はリポジトリのデータだけでビルドする
  } else {
    try {
      const summary = await pullCms({ env: process.env });
      console.log(
        `cms:pull: 記事 ${summary.articles}件・事例 ${summary.cases}件・画像 ${summary.images.total}件（新規 ${summary.images.downloaded}・削除 ${summary.images.removed}）`,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
