/**
 * 公開後の定期監視（#32、ADR 0046）。
 *
 *     npm run monitor -- --url https://<ドメイン>
 *     SITE_URL=https://<ドメイン> npm run monitor
 *     npm run monitor -- --url https://example.jp --dist out   通信せずに判定を試す
 *
 * SITE_URL 未指定では自社の公開判断に一致する DOMAIN を使う。顧客サイトは明示設定が必要。
 * FAIL が1件でもあれば終了コード 1（ワークフローが失敗し、GitHub の標準の通知が届く）。
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../../paths';
import { report } from '../results';
import { checkMonitor } from '../site-checks';
import { monitorTarget, siteExpectations } from '../site-expectations';
import { nonNegativeInteger, probeFor } from './options';

const USAGE =
  '使い方: npm run monitor -- --url https://<ドメイン> [--slow-ms 3000] [--warn-cert-days 21] [--fail-cert-days 7] [--json <file>] [--dist out]（--url の代わりに環境変数 SITE_URL も可）';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: process.env.SITE_URL ?? '' },
    dist: { type: 'string' },
    json: { type: 'string', default: join(ROOT, '.artifacts', 'ops', 'monitor.json') },
    'slow-ms': { type: 'string', default: '3000' },
    'warn-cert-days': { type: 'string', default: '21' },
    'fail-cert-days': { type: 'string', default: '7' },
  },
});

try {
  const site = monitorTarget(values.url);
  const startedAt = new Date();
  const results = await checkMonitor(site, probeFor(values.dist), {
    ...siteExpectations(),
    slowMs: nonNegativeInteger(values['slow-ms'], '--slow-ms'),
    warnDays: nonNegativeInteger(values['warn-cert-days'], '--warn-cert-days'),
    failDays: nonNegativeInteger(values['fail-cert-days'], '--fail-cert-days'),
    now: startedAt,
  });
  const title = values.dist ? '公開後の監視（out/ の模擬配信）' : '公開後の監視';
  process.exitCode = report(title, results, { target: site.origin, startedAt, json: values.json });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(USAGE);
  process.exitCode = 2;
}
