/**
 * 公開したサイトを外から確かめる検査。
 *
 * - checkLive    … 独自ドメインでの公開直後の受け入れ確認（npm run check:live、ADR 0044）
 * - checkMonitor … 公開後の定期監視（npm run monitor、ADR 0046）
 *
 * 問い合わせはすべて Probe 経由。ここではネットワークに直接触らない。
 */
import { inspectHtml } from './html';
import type { HttpResult, Probe } from './probe';
import { result, type CheckResult } from './results';

const DAY_MS = 86_400_000;
const LIST_LIMIT = 8;

export interface CertificatePolicy {
  /** 残り日数がこれ未満なら WARN */
  warnDays: number;
  /** 残り日数がこれ未満なら FAIL */
  failDays: number;
  now?: Date;
  /** Known public paths from the checkout; do not trust the remote sitemap as the only inventory. */
  expectedPaths?: readonly string[];
  contact?: { path: string; links: readonly string[] };
  /** Exact values from the deployment policy. Offline hosting cannot establish these. */
  expectedHeaders?: Readonly<Record<string, string>>;
}

/** `https://<ドメイン>` だけを受け付ける（パス・ポート・クエリ付きは取り違えの元なので拒否）。 */
export function parseSiteUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`URL として読めません: ${value}`);
  }
  if (url.protocol !== 'https:')
    throw new Error(`https:// で始まる URL を指定してください: ${value}`);
  if (url.pathname !== '/' || url.search || url.hash || url.port || url.username || url.password)
    throw new Error(`ドメインのトップ（https://<ドメイン> の形）を指定してください: ${value}`);
  return url;
}

const describe = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? `（${error.cause.message}）` : '';
  return `${error.message}${cause}`;
};

const listed = (items: readonly string[]) =>
  items.slice(0, LIST_LIMIT).join('\n') +
  (items.length > LIST_LIMIT ? `\nほか ${items.length - LIST_LIMIT} 件` : '');

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const offline = (name: string) => result('SKIP', name, 'out/ を読む模擬配信のため確認していない');

async function checkDns(probe: Probe, host: string) {
  const name = 'DNS の解決';
  if (!probe.network) return offline(name);
  try {
    const addresses = await probe.lookup(host);
    return addresses.length
      ? result('PASS', name, `${host} → ${addresses.join(', ')}`)
      : result('FAIL', name, `${host} のアドレスが返らない`);
  } catch (error) {
    return result('FAIL', name, `${host}: ${describe(error)}`);
  }
}

async function checkCertificate(probe: Probe, host: string, policy: CertificatePolicy) {
  const name = 'HTTPS の証明書';
  if (!probe.network) return offline(name);
  try {
    const certificate = await probe.certificate(host);
    const days = Math.floor(
      (certificate.validTo.getTime() - (policy.now ?? new Date()).getTime()) / DAY_MS,
    );
    const detail = `残り ${days} 日（期限 ${certificate.validTo.toISOString().slice(0, 10)}、発行者 ${certificate.issuer || '不明'}）`;
    if (!certificate.authorized)
      return result('FAIL', name, `検証できない: ${certificate.error ?? '理由不明'}。${detail}`);
    if (days < policy.failDays) return result('FAIL', name, `${detail}。${policy.failDays} 日未満`);
    if (days < policy.warnDays) return result('WARN', name, `${detail}。${policy.warnDays} 日未満`);
    return result('PASS', name, detail);
  } catch (error) {
    return result('FAIL', name, `${host}:443 に TLS で接続できない: ${describe(error)}`);
  }
}

async function checkHttpsRedirect(probe: Probe, host: string) {
  const name = 'HTTP から HTTPS への転送';
  if (!probe.network) return offline(name);
  try {
    const response = await probe.get(`http://${host}/`);
    const target = response.location ?? '';
    const toHttps = target.startsWith(`https://${host}/`);
    if (toHttps && [301, 308].includes(response.status))
      return result('PASS', name, `${response.status} → ${target}`);
    if (toHttps && [302, 307].includes(response.status))
      return result(
        'WARN',
        name,
        `一時転送 ${response.status} → ${target}（恒久転送 301/308 が望ましい）`,
      );
    return result(
      'FAIL',
      name,
      `http://${host}/ が ${response.status}${target ? ` → ${target}` : ''}`,
    );
  } catch (error) {
    return result('FAIL', name, describe(error));
  }
}

async function getOrFail(probe: Probe, url: string, name: string) {
  try {
    const response = await probe.get(url);
    if (response.status === 200) return response;
    return result(
      'FAIL',
      name,
      `${url} が ${response.status}${response.location ? ` → ${response.location}` : ''}`,
    );
  } catch (error) {
    return result('FAIL', name, `${url}: ${describe(error)}`);
  }
}

async function checkTopPage(probe: Probe, origin: string) {
  const name = 'トップページの応答';
  const response = await getOrFail(probe, `${origin}/`, name);
  return {
    check: 'ms' in response ? result('PASS', name, `200（${response.ms}ms）`) : response,
    page: 'ms' in response ? { url: `${origin}/`, response } : null,
  };
}

function robotsProblems(body: string, origin: string): string[] {
  let agents: string[] = [];
  let inRules = false;
  let blocksAll = false;
  const sitemaps: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (inRules) agents = [];
      inRules = false;
      agents.push(value.toLowerCase());
    } else if (key === 'allow' || key === 'disallow') {
      inRules = true;
      if (key === 'disallow' && value === '/' && agents.includes('*')) blocksAll = true;
    } else if (key === 'sitemap') sitemaps.push(value);
  }
  const problems: string[] = [];
  if (blocksAll) problems.push('User-agent: * に Disallow: / がある（検索に載らない）');
  if (!sitemaps.includes(`${origin}/sitemap.xml`))
    problems.push(
      `Sitemap: ${origin}/sitemap.xml がない（記載: ${sitemaps.join(', ') || 'なし'}）`,
    );
  return problems;
}

async function checkRobots(probe: Probe, origin: string) {
  const name = 'robots.txt';
  const response = await getOrFail(probe, `${origin}/robots.txt`, name);
  if (!('ms' in response)) return response;
  const problems = robotsProblems(response.body, origin);
  return problems.length
    ? result('FAIL', name, problems.join('\n'))
    : result('PASS', name, `取得できた。全体の拒否なし、Sitemap は ${origin}/sitemap.xml`);
}

const decodeXml = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

async function readSitemap(probe: Probe, origin: string) {
  const name = 'sitemap.xml';
  const response = await getOrFail(probe, `${origin}/sitemap.xml`, name);
  if (!('ms' in response)) return { check: response, urls: [] };
  const urls = [...response.body.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((match) =>
    decodeXml(match[1]!),
  );
  if (!urls.length) return { check: result('FAIL', name, '<loc> が1件もない'), urls };
  const foreign = urls.filter((url) => {
    try {
      const parsed = new URL(url);
      return (
        parsed.origin !== origin ||
        !!(parsed.username || parsed.password || parsed.search || parsed.hash)
      );
    } catch {
      return true;
    }
  });
  if (foreign.length)
    return {
      check: result(
        'FAIL',
        name,
        `${origin} 以外を指す URL が ${foreign.length} 件\n${listed(foreign)}`,
      ),
      urls: urls.filter((url) => !foreign.includes(url)),
    };
  if (new Set(urls).size !== urls.length)
    return {
      check: result('FAIL', name, '同じ URL が重複して掲載されている'),
      urls: [...new Set(urls)],
    };
  return { check: result('PASS', name, `${urls.length} 件、すべて ${origin} を指す`), urls };
}

function expectedUrls(origin: string, paths: readonly string[]): string[] {
  return paths.map((path) => {
    const url = new URL(path, origin);
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      url.origin !== origin ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw new Error(`期待するページは同じサイトの絶対パスで指定してください: ${path}`);
    return url.href;
  });
}

function checkInventory(actual: readonly string[], expected: readonly string[]) {
  const missing = expected.filter((url) => !actual.includes(url));
  const extra = actual.filter((url) => !expected.includes(url));
  const problems = [
    ...missing.map((url) => `不足: ${pathOf(url)}`),
    ...extra.map((url) => `未登録: ${pathOf(url)}`),
  ];
  return problems.length
    ? result('FAIL', '公開ページ一覧の一致', listed(problems))
    : result(
        'PASS',
        '公開ページ一覧の一致',
        `コードで定義した ${expected.length} URL と sitemap が一致`,
      );
}

type Fetched = { url: string; response: HttpResult } | { url: string; error: string };

async function fetchAll(probe: Probe, urls: readonly string[]): Promise<Fetched[]> {
  const pages: Fetched[] = [];
  // 応答時間を並列の待ち合わせで汚さないよう、1件ずつ取る
  for (const url of urls) {
    try {
      pages.push({ url, response: await probe.get(url) });
    } catch (error) {
      pages.push({ url, error: describe(error) });
    }
  }
  return pages;
}

function checkPageStatus(pages: readonly Fetched[]) {
  const name = 'sitemap 掲載 URL の応答';
  if (!pages.length) return result('FAIL', name, '確かめる URL がない');
  const failures = pages.flatMap((page) =>
    'error' in page
      ? [`${pathOf(page.url)} → ${page.error}`]
      : page.response.status === 200
        ? []
        : [`${pathOf(page.url)} → ${page.response.status}`],
  );
  return failures.length
    ? result(
        'FAIL',
        name,
        `${failures.length} / ${pages.length} 件が 200 でない\n${listed(failures)}`,
      )
    : result('PASS', name, `${pages.length} 件すべて 200（転送なし）`);
}

const okPages = (pages: readonly Fetched[]) =>
  pages.flatMap((page) =>
    'response' in page && page.response.status === 200
      ? [
          {
            url: page.url,
            facts: inspectHtml(page.response.body),
            robotsTag: page.response.robotsTag ?? '',
          },
        ]
      : [],
  );

function checkSelfReference(
  pages: ReturnType<typeof okPages>,
  name: string,
  pick: (facts: ReturnType<typeof inspectHtml>) => string[],
) {
  if (!pages.length) return result('SKIP', name, '200 で取得できたページがない');
  const problems = pages.flatMap(({ url, facts }) => {
    const values = pick(facts);
    if (values.length !== 1) return [`${pathOf(url)}: ${values.length} 個`];
    return values[0] === url ? [] : [`${pathOf(url)}: ${values[0]}`];
  });
  return problems.length
    ? result('FAIL', name, `${problems.length} ページが掲載 URL と一致しない\n${listed(problems)}`)
    : result('PASS', name, `${pages.length} ページすべて掲載 URL（このドメイン）と一致`);
}

function checkNoRuntimeJs(pages: ReturnType<typeof okPages>) {
  const name = '実行時 JavaScript なし';
  if (!pages.length) return result('SKIP', name, '200 で取得できたページがない');
  const problems = pages.flatMap(({ url, facts }) =>
    [...facts.runtimeScripts, ...facts.inlineHandlers].map((found) => `${pathOf(url)}: ${found}`),
  );
  return problems.length
    ? result(
        'FAIL',
        name,
        `配信された HTML に script・イベント属性が ${problems.length} 件\n${listed(problems)}`,
      )
    : result('PASS', name, `${pages.length} ページとも JSON-LD 以外の script なし`);
}

function checkIndexability(pages: ReturnType<typeof okPages>) {
  const name = '検索除外の混入なし';
  if (!pages.length) return result('SKIP', name, '200 で取得できたページがない');
  // Match directives, not values such as max-image-preview:none. Header agent scopes are preserved in the report.
  const excluded = (value: string) =>
    value.split(',').some((part) => {
      const rule = part.trim().toLowerCase();
      return (
        /^(noindex|none)$/.test(rule) ||
        /^[a-z0-9_-]+:\s*noindex$/.test(rule) ||
        /^(googlebot|bingbot):\s*none$/.test(rule)
      );
    });
  const problems = pages.flatMap(({ url, facts, robotsTag }) =>
    [...facts.robots, robotsTag].filter(excluded).map((value) => `${pathOf(url)}: ${value}`),
  );
  return problems.length
    ? result('FAIL', name, listed(problems))
    : result(
        'PASS',
        name,
        `${pages.length} ページの robots meta・X-Robots-Tag に noindex / none なし（検索掲載の保証ではない）`,
      );
}

function checkContact(
  pages: ReturnType<typeof okPages>,
  origin: string,
  contact: NonNullable<CertificatePolicy['contact']>,
) {
  const url = expectedUrls(origin, [contact.path])[0]!;
  const page = pages.find((page) => page.url === url);
  const missing = contact.links.filter((link) => !page?.facts.links.includes(link));
  if (!page || missing.length)
    return result(
      'FAIL',
      '問い合わせ導線',
      `${contact.path}: ${page ? `設定済みリンクが不足: ${missing.join(', ')}` : 'ページを取得できない'}`,
    );
  return result(
    'PASS',
    '問い合わせ導線',
    `${contact.path} に設定済みの ${contact.links.length} リンクあり（通話・送信はしていない）`,
  );
}

async function checkNotFound(probe: Probe, origin: string, now: Date) {
  const name = '存在しない URL は 404';
  const url = `${origin}/tsumugi-check-missing-${now.getTime().toString(36)}.html`;
  try {
    const response = await probe.get(url);
    return response.status === 404
      ? result('PASS', name, `${pathOf(url)} → 404`)
      : result('FAIL', name, `${pathOf(url)} → ${response.status}（404 にならない）`);
  } catch (error) {
    return result('FAIL', name, describe(error));
  }
}

function checkHeaders(
  pages: readonly Fetched[],
  probe: Probe,
  expected: Readonly<Record<string, string>>,
) {
  const name = '配信セキュリティヘッダー';
  if (!probe.network) return offline(name);
  const readable = pages.filter((page) => 'response' in page && page.response.status === 200);
  if (!readable.length) return result('FAIL', name, '200 で取得できたページがない');
  const entries = Object.entries(expected);
  if (!entries.length) return result('FAIL', name, '期待するヘッダーが未設定');
  const problems = readable.flatMap((page) => {
    if (!('response' in page)) return [];
    const headers = new Headers(page.response.headers);
    return entries.flatMap(([key, value]) =>
      headers.get(key)?.trim() === value.trim()
        ? []
        : [
            `${pathOf(page.url)}: ${key} が配備設定と不一致（${headers.has(key) ? '値の変更' : '欠落'}）`,
          ],
    );
  });
  return problems.length
    ? result('FAIL', name, `${problems.length} 件の不一致\n${listed(problems)}`)
    : result('PASS', name, `${readable.length} URL × ${entries.length} ヘッダーが配備設定と一致`);
}

/** 独自ドメインでの公開直後に確かめる項目（#14）。 */
async function inspectSite(site: URL, probe: Probe, policy: CertificatePolicy) {
  const { origin, hostname } = site;
  const expected = policy.expectedPaths ? expectedUrls(origin, policy.expectedPaths) : null;
  const contactUrls = policy.contact ? expectedUrls(origin, [policy.contact.path]) : [];
  const top = await checkTopPage(probe, origin);
  const results = [
    await checkDns(probe, hostname),
    await checkCertificate(probe, hostname, policy),
    await checkHttpsRedirect(probe, hostname),
    top.check,
    await checkRobots(probe, origin),
  ];
  const sitemap = await readSitemap(probe, origin);
  results.push(sitemap.check);
  if (expected) results.push(checkInventory(sitemap.urls, expected));
  const pages = await fetchAll(probe, [
    ...new Set([...sitemap.urls, ...(expected ?? []), ...contactUrls]),
  ]);
  const readable = okPages(pages);
  if (policy.expectedHeaders)
    results.push(
      checkHeaders(top.page ? [top.page, ...pages] : pages, probe, policy.expectedHeaders),
    );
  results.push(
    checkPageStatus(pages),
    checkSelfReference(readable, 'canonical がこのドメインを指す', (facts) => facts.canonical),
    checkSelfReference(readable, 'og:url がこのドメインを指す', (facts) => facts.ogUrl),
    checkNoRuntimeJs(readable),
    checkIndexability(readable),
    await checkNotFound(probe, origin, policy.now ?? new Date()),
  );
  if (policy.contact) results.push(checkContact(readable, origin, policy.contact));
  return { results, pages };
}

/** Public endpoint checks do not send forms, email or telephone calls. */
export async function checkLive(
  site: URL,
  probe: Probe,
  policy: CertificatePolicy,
): Promise<CheckResult[]> {
  return (await inspectSite(site, probe, policy)).results;
}

export interface MonitorPolicy extends CertificatePolicy {
  /** 1 ページの取得（本文の受信完了まで）がこれを超えたら WARN（ミリ秒） */
  slowMs: number;
}

function checkResponseTimes(pages: readonly Fetched[], slowMs: number) {
  const name = '応答時間';
  const timed = pages.flatMap((page) =>
    'response' in page ? [{ url: page.url, ms: page.response.ms }] : [],
  );
  if (!timed.length) return result('SKIP', name, '応答を受け取れたページがない');
  const sorted = timed.map((entry) => entry.ms).sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)]!;
  const detail = `${timed.length} ページ、中央値 ${median}ms・最大 ${sorted.at(-1)}ms（実行した場所からの取得時間。利用者の表示速度ではない）`;
  const slow = timed
    .filter((entry) => entry.ms > slowMs)
    .map((entry) => `${pathOf(entry.url)}: ${entry.ms}ms`);
  return slow.length
    ? result('WARN', name, `${detail}。${slowMs}ms 超が ${slow.length} 件\n${listed(slow)}`)
    : result('PASS', name, detail);
}

/** 定期監視にも公開直後と同じ検査を適用し、応答時間を加える。 */
export async function checkMonitor(
  site: URL,
  probe: Probe,
  policy: MonitorPolicy,
): Promise<CheckResult[]> {
  const { results, pages } = await inspectSite(site, probe, policy);
  results.push(checkResponseTimes(pages, policy.slowMs));
  return results;
}
