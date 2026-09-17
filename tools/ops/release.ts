/** 指定された公開成果物と配信内容の一致を検査する。コミット・配備IDの推測はしない。 */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Fetch } from './probe';
import { result, type CheckResult } from './results';
import { parseSiteUrl } from './site-checks';

interface ArtifactFile {
  path: string;
  bytes: number;
  sha256: string;
}
const hash = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

/** 公開用ディレクトリだけを指定する。リンク先や隠しファイルは読まない。 */
function inventory(dist: string): ArtifactFile[] {
  const root = resolve(dist);
  if (lstatSync(root).isSymbolicLink())
    throw new Error('比較元にシンボリックリンクは指定できません');
  const files: ArtifactFile[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith('.'))
        throw new Error(`公開成果物に隠しファイルがあります: ${prefix}${name}`);
      const path = join(dir, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`公開成果物にリンクがあります: ${prefix}${name}`);
      if (stat.isDirectory()) walk(path, `${prefix}${name}/`);
      else {
        if (!stat.isFile()) throw new Error(`通常のファイルではありません: ${prefix}${name}`);
        if (stat.size > 64 * 1024 * 1024)
          throw new Error(`比較元のファイルが64MiBを超えています: ${prefix}${name}`);
        const data = readFileSync(path);
        files.push({ path: `${prefix}${name}`, bytes: data.length, sha256: hash(data) });
        if (files.length > 1000) throw new Error('比較元は1000ファイル以内にしてください');
      }
    }
  };
  walk(root, '');
  if (!files.some((file) => file.path === 'index.html'))
    throw new Error('比較元に index.html がありません。公開用の成果物を指定してください');
  return files;
}

export async function checkRelease(
  origin: string,
  dist: string,
  options: {
    fetch?: Fetch;
    expectedFingerprint?: string;
  } = {},
): Promise<CheckResult[]> {
  const site = parseSiteUrl(origin);
  const files = inventory(dist);
  const fingerprint = hash(JSON.stringify(files));
  if (options.expectedFingerprint !== undefined && options.expectedFingerprint !== fingerprint)
    throw new Error(`比較元の指紋が一致しません（実際 ${fingerprint}）`);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  // index.html の URL と、実際の入口 / を両方確認する。
  const targets = [
    ...files.map((file) => ({
      file,
      path: '/' + file.path.split('/').map(encodeURIComponent).join('/'),
    })),
    { file: files.find((f) => f.path === 'index.html')!, path: '/' },
  ];
  const results: CheckResult[] = new Array(targets.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const i = cursor++;
      const { file, path } = targets[i]!;
      try {
        const response = await fetchImpl(new URL(path, site).href, {
          redirect: 'manual',
          signal: AbortSignal.timeout(15_000),
          headers: { 'user-agent': 'tsumugi-release-check', 'cache-control': 'no-cache' },
        });
        if (response.status !== 200 && !(file.path === '404.html' && response.status === 404)) {
          await response.body?.cancel();
          results[i] = result('FAIL', path, `HTTP ${response.status}（転送は追跡しません）`);
          continue;
        }
        const digest = createHash('sha256');
        let bytes = 0;
        const reader = response.body?.getReader();
        if (reader) {
          try {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              bytes += chunk.value.length;
              if (bytes > file.bytes) {
                await reader.cancel();
                break;
              }
              digest.update(chunk.value);
            }
          } finally {
            reader.releaseLock();
          }
        }
        const actual = digest.digest('hex');
        results[i] =
          bytes === file.bytes && actual === file.sha256
            ? result('PASS', path, `${file.bytes} bytes・SHA-256 ${file.sha256}`)
            : result(
                'FAIL',
                path,
                bytes > file.bytes
                  ? `配信内容が比較元の ${file.bytes} bytes を超えています`
                  : `配信内容が不一致（期待 ${file.bytes} bytes / ${file.sha256}、実際 ${bytes} bytes / ${actual}）`,
              );
      } catch (error) {
        results[i] = result('FAIL', path, error instanceof Error ? error.message : String(error));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));
  return [
    result(
      'PASS',
      '比較元成果物の指紋',
      `${fingerprint}（${files.length}ファイル。配備ID・コミットの証明ではありません）`,
    ),
    ...results,
  ];
}
