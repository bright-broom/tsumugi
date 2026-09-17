/** HEAD checks for same-origin CSS/images directly referenced by public HTML. */
import type { PageFacts } from './html';
import type { Probe } from './probe';
import { result } from './results';

const LIMIT = 128;

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
  const scope = `${assets.size}資産、外部・埋込など${excluded}参照は対象外。本文の完全性やCSS内参照は未検証`;
  return problems.length
    ? result(
        'FAIL',
        name,
        `${problems.length}件の不備\n${problems.slice(0, 8).join('\n')}\n${scope}`,
      )
    : result('PASS', name, `HEAD 200・Content-Type一致。${scope}`);
}
