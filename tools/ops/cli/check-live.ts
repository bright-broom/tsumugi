/**
 * 独自ドメインでの公開後の確認（#14、ADR 0044）。
 *
 *     npm run check:live -- --url https://<ドメイン>
 *     npm run check:live -- --url https://example.jp --dist out   公開前のリハーサル（out/ を読む。通信しない）
 *
 * FAIL が1件でもあれば終了コード 1。結果は .artifacts/ops/check-live.json にも残す。
 */
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DOMAIN } from '@/content/config';
import { ROOT } from '../../paths';
import { createProbe, distFetch } from '../probe';
import { report, result } from '../results';
import { checkLive, parseSiteUrl } from '../site-checks';

const USAGE =
  '使い方: npm run check:live -- --url https://<ドメイン> [--dist out] [--json <file>] [--warn-cert-days 21] [--fail-cert-days 7]';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    dist: { type: 'string' },
    json: { type: 'string', default: join(ROOT, '.artifacts', 'ops', 'check-live.json') },
    'warn-cert-days': { type: 'string', default: '21' },
    'fail-cert-days': { type: 'string', default: '7' },
  },
});

const days = (value: string, flag: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} は 0 以上の整数: ${value}`);
  return parsed;
};

try {
  if (!values.url) throw new Error(USAGE);
  const site = parseSiteUrl(values.url);
  const startedAt = new Date();
  const probe = values.dist
    ? createProbe({ fetch: distFetch(resolve(values.dist)), network: false })
    : createProbe();
  const results = [
    site.hostname === DOMAIN
      ? result('PASS', 'ビルド設定の DOMAIN', `src/content/config.ts も ${DOMAIN}`)
      : result(
          'WARN',
          'ビルド設定の DOMAIN',
          `src/content/config.ts は ${DOMAIN}。このリポジトリからのビルドは canonical が ${site.hostname} を指さない`,
        ),
    ...(await checkLive(site, probe, {
      warnDays: days(values['warn-cert-days'], '--warn-cert-days'),
      failDays: days(values['fail-cert-days'], '--fail-cert-days'),
      now: startedAt,
    })),
  ];
  const title = values.dist ? '公開後の確認（out/ のリハーサル）' : '公開後の確認';
  process.exitCode = report(title, results, { target: site.origin, startedAt, json: values.json });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
