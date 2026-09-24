/**
 * HEAD checks for same-origin CSS/images directly referenced by public HTML,
 * plus the same-origin files those stylesheets reach through url() and @import
 * (fonts and background images are only reachable that way). 監査 A06。
 */
import type { PageFacts } from './html';
import type { Probe } from './probe';
import { result } from './results';

const LIMIT = 128;

/** url(...) と @import が指す先。data: や外部サイトは対象外。 */
export function cssReferences(css: string, base: string): string[] {
  const origin = new URL(base).origin;
  // コメントの中の参照は配信されない
  const text = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const targets = [
    ...[...text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2] ?? ''),
    ...[...text.matchAll(/@import\s+(['"])([^'"]+)\1/g)].map((m) => m[2] ?? ''),
  ];
  const found: string[] = [];
  for (const target of targets) {
    const value = target.trim();
    if (!value || value.startsWith('data:') || value.startsWith('#')) continue;
    let url: URL;
    try {
      url = new URL(value, base);
    } catch {
      continue;
    }
    if (url.origin !== origin || url.username || url.password) continue;
    url.hash = '';
    if (!found.includes(url.href)) found.push(url.href);
  }
  return found;
}

/** 200 で取れた CSS をたどり、その中から参照される同一サイトのファイルを確かめる。 */
async function followStylesheets(
  stylesheets: readonly string[],
  probe: Probe,
  budget: number,
): Promise<{ checked: number; problems: string[] }> {
  const problems: string[] = [];
  const seen = new Set(stylesheets);
  const queue = [...stylesheets];
  let checked = 0;
  while (queue.length && checked < budget) {
    const sheet = queue.shift()!;
    let css: string;
    try {
      const response = await probe.get(sheet);
      if (response.status !== 200) {
        problems.push(`${new URL(sheet).pathname}: CSS を GET できない（${response.status}）`);
        continue;
      }
      css = response.body;
    } catch {
      problems.push(`${new URL(sheet).pathname}: CSS の取得に失敗`);
      continue;
    }
    for (const url of cssReferences(css, sheet)) {
      if (seen.has(url)) continue;
      seen.add(url);
      if (checked >= budget) {
        problems.push(`CSS 内の参照が上限 ${budget} 件を超えたため、残りは確かめていない`);
        break;
      }
      checked += 1;
      const label = `${new URL(sheet).pathname} → ${new URL(url).pathname}`;
      try {
        const response = await probe.head(url);
        const mime =
          new Headers(response.headers).get('content-type')?.split(';')[0]?.trim().toLowerCase() ??
          '';
        if (response.status !== 200)
          problems.push(`${label}: HEAD ${response.status}（CSS 内の参照が配信されていない）`);
        // 無い道筋に HTML を返す配信では、404 にならずに壊れた表示だけが残る
        else if (mime.startsWith('text/html'))
          problems.push(`${label}: HTML が返る（ファイルがない可能性）`);
        else if (url.endsWith('.css')) {
          if (mime !== 'text/css')
            problems.push(`${label}: CSS の Content-Type 不一致（${mime || '未設定'}）`);
          else queue.push(url);
        }
      } catch {
        problems.push(`${label}: HEAD 取得失敗`);
      }
    }
  }
  return { checked, problems };
}

export async function checkReferencedAssets(
  pages: readonly { url: string; facts: PageFacts }[],
  probe: Probe,
) {
  const name = '参照CSS・画像の配信';
  if (!pages.length) return result('FAIL', name, '200で取得できたページがない');
  const assets = new Map<string, Set<'css' | 'image'>>();
  const problems: string[] = [];
  let excluded = 0;
  for (const page of pages)
    for (const asset of page.facts.assets) {
      let url: URL;
      try {
        if (!asset.url.trim()) throw new Error('empty reference');
        url = new URL(asset.url, page.url);
      } catch {
        problems.push(`${new URL(page.url).pathname}: 資産URLが不正`);
        continue;
      }
      if (url.username || url.password) {
        problems.push(`${new URL(page.url).pathname}: 認証情報付き資産URLは取得しない`);
        continue;
      }
      if (url.origin !== new URL(page.url).origin) {
        excluded++;
        continue;
      }
      url.hash = '';
      const kinds = assets.get(url.href) ?? new Set<'css' | 'image'>();
      kinds.add(asset.kind);
      assets.set(url.href, kinds);
      if (assets.size > LIMIT)
        return result('FAIL', name, `資産が上限${LIMIT}件を超えたため、資産の取得は実行していない`);
    }
  if (!assets.size)
    return result(
      'FAIL',
      name,
      problems.join('\n') || `検査できる同一サイトの資産がない（対象外参照${excluded}件）`,
    );
  const entries = [...assets.entries()];
  const failures: string[][] = Array.from({ length: entries.length }, () => []);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, entries.length) }, async () => {
      while (cursor < entries.length) {
        const index = cursor++;
        const [url, kinds] = entries[index]!;
        const label = new URL(url).pathname;
        try {
          const response = await probe.head(url);
          const mime =
            new Headers(response.headers)
              .get('content-type')
              ?.split(';')[0]
              ?.trim()
              .toLowerCase() ?? '';
          if (response.status !== 200)
            failures[index]!.push(`${label}: HEAD ${response.status}（転送なしの200が必要）`);
          else
            for (const kind of kinds) {
              if (kind === 'css' ? mime !== 'text/css' : !mime.startsWith('image/'))
                failures[index]!.push(
                  `${label}: ${kind}のContent-Type不一致（${mime || '未設定'}）`,
                );
            }
        } catch {
          failures[index]!.push(`${label}: HEAD取得失敗`);
        }
      }
    }),
  );
  problems.push(...failures.flat());
  const stylesheets = entries
    .filter(([, kinds], index) => kinds.has('css') && !failures[index]!.length)
    .map(([url]) => url);
  const followed = await followStylesheets(stylesheets, probe, LIMIT - assets.size);
  problems.push(...followed.problems);
  const scope = `${assets.size}資産とCSS内の${followed.checked}参照、外部・埋込など${excluded}参照は対象外。本文の完全性は未検証`;
  return problems.length
    ? result(
        'FAIL',
        name,
        `${problems.length}件の不備\n${problems.slice(0, 8).join('\n')}\n${scope}`,
      )
    : result('PASS', name, `HEAD 200・Content-Type一致。${scope}`);
}
