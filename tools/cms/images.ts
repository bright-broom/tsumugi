/**
 * CMS の画像をビルド時に自サイトへ取り込む（ADR 0080）。
 * 公開ページは自サイトの画像だけを表示する（CSP の img-src 'self'）。所有の方針どおり、CMS を解約しても画像が残る。
 * microCMS の画像 API で WebP・最大幅に変換してから保存し、ファイル名は元 URL と幅から決める。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CmsError, type ImageResolver } from './microcms';

type Fetch = typeof globalThis.fetch;

interface PlannedImage {
  source: string;
  file: string;
}

export const CMS_IMAGE_DIR = 'cms';

export function planImages({ maxWidth = 1600 }: { maxWidth?: number } = {}) {
  const planned = new Map<string, PlannedImage>();
  const resolve: ImageResolver = (image) => {
    const width = Math.min(image.width, maxWidth);
    const height = Math.max(1, Math.round((image.height * width) / image.width));
    const file = `${createHash('sha256').update(`${image.url}|${width}`).digest('hex').slice(0, 20)}.webp`;
    planned.set(file, { file, source: `${image.url}?fm=webp&q=80&w=${width}` });
    return { src: `/images/${CMS_IMAGE_DIR}/${file}`, alt: image.alt, width, height };
  };
  return { resolve, planned };
}

const isWebp = (bytes: Uint8Array) =>
  bytes.length > 12 &&
  String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
  String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';

/** 予定の画像を保存し、予定にない古い画像を消す。保存済みのものは取り直さない。 */
export async function downloadImages(
  planned: ReadonlyMap<string, PlannedImage>,
  directory: string,
  {
    fetch = globalThis.fetch,
    maxBytes = 10 * 1024 * 1024,
  }: { fetch?: Fetch; maxBytes?: number } = {},
) {
  mkdirSync(directory, { recursive: true });
  let downloaded = 0;
  for (const image of planned.values()) {
    const path = join(directory, image.file);
    if (existsSync(path)) continue;
    const response = await fetch(image.source, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new CmsError(
        `画像を取得できません: HTTP ${response.status}（${new URL(image.source).pathname}）`,
      );
    }
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > maxBytes) {
      await response.body?.cancel();
      throw new CmsError(
        `画像が大きすぎます（${length} bytes）: ${new URL(image.source).pathname}`,
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > maxBytes || !isWebp(bytes))
      throw new CmsError(`WebP の画像ではないか、大きすぎます: ${new URL(image.source).pathname}`);
    writeFileSync(path, bytes);
    downloaded++;
  }
  let removed = 0;
  for (const name of readdirSync(directory))
    if (!planned.has(name)) {
      rmSync(join(directory, name));
      removed++;
    }
  return { downloaded, removed, total: planned.size };
}
