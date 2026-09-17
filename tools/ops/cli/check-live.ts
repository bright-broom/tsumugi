/**
 * 独自ドメインでの公開後の確認（#14、ADR 0044）。
 *
 *     npm run check:live -- --url https://<ドメイン>
 *     npm run check:live -- --url https://example.jp --dist out   公開前のリハーサル（out/ を読む。通信しない）
 *
 * FAIL が1件でもあれば終了コード 1。結果は .artifacts/ops/check-live.json にも残す。
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DOMAIN } from '@/content/config';
import { ROOT } from '../../paths';
import { report, result } from '../results';
import { checkLive, parseSiteUrl } from '../site-checks';
import { nonNegativeInteger, probeFor } from './options';
import { siteExpectations } from '../site-expectations';

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

try {
  if (!values.url) throw new Error(USAGE);
  const site = parseSiteUrl(values.url);
  const startedAt = new Date();
  const probe = probeFor(values.dist);
  const results = [
    site.hostname === DOMAIN
      ? result('PASS', 'ビルド設定の DOMAIN', `src/content/config.ts も ${DOMAIN}`)
      : result(
          'WARN',
          'ビルド設定の DOMAIN',
          `src/content/config.ts は ${DOMAIN}。このリポジトリからのビルドは canonical が ${site.hostname} を指さない`,
        ),
    ...(await checkLive(site, probe, {
      ...siteExpectations(),
      warnDays: nonNegativeInteger(values['warn-cert-days'], '--warn-cert-days'),
      failDays: nonNegativeInteger(values['fail-cert-days'], '--fail-cert-days'),
      now: startedAt,
    })),
  ];
  const title = values.dist ? '公開後の確認（out/ のリハーサル）' : '公開後の確認';
  process.exitCode = report(title, results, { target: site.origin, startedAt, json: values.json });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
}
