/**
 * 公開成果物と配信内容を照合する。比較元は必ず明示する。
 *
 *     npm run check:release -- --url https://<公開先> --dist out
 *     npm run check:release -- --dist out --wait-seconds 900   配備の切替を待って照合（ADR 0076）
 *
 * --url 未指定では環境変数 SITE_URL、なければ自社の公開判断に一致する DOMAIN（監視と同じ規則）。
 */
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../../paths';
import { checkRelease, waitForRelease } from '../release';
import { distFetch } from '../probe';
import { report } from '../results';
import { monitorTarget } from '../site-expectations';
import { nonNegativeInteger } from './options';

const USAGE =
  '使い方: npm run check:release -- --dist <比較元成果物> [--url https://<公開先>] [--fingerprint <SHA256>] [--served-dist <模擬配信元>] [--wait-seconds 0] [--interval-seconds 30] [--json <記録先>]';

try {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', default: process.env.SITE_URL ?? '' },
      dist: { type: 'string' },
      fingerprint: { type: 'string' },
      'served-dist': { type: 'string' },
      'wait-seconds': { type: 'string', default: '0' },
      'interval-seconds': { type: 'string', default: '30' },
      json: { type: 'string', default: join(ROOT, '.artifacts', 'ops', 'check-release.json') },
    },
  });
  if (!values.dist) throw new Error('比較元成果物（--dist）を指定してください。');
  const waitSeconds = nonNegativeInteger(values['wait-seconds'], '--wait-seconds');
  const intervalSeconds = nonNegativeInteger(values['interval-seconds'], '--interval-seconds');
  if (waitSeconds > 0 && intervalSeconds < 5)
    throw new Error('--wait-seconds を使うときは --interval-seconds を5以上にしてください');
  const site = monitorTarget(values.url);
  const dist = resolve(values.dist);
  const startedAt = new Date();
  const check = () =>
    checkRelease(site.origin, dist, {
      expectedFingerprint: values.fingerprint,
      ...(values['served-dist'] ? { fetch: distFetch(resolve(values['served-dist'])) } : {}),
    });
  const results =
    waitSeconds > 0
      ? await waitForRelease(check, {
          timeoutMs: waitSeconds * 1000,
          intervalMs: intervalSeconds * 1000,
        })
      : await check();
  process.exitCode = report(
    values['served-dist'] ? '公開成果物の一致検査（模擬配信・通信なし）' : '公開成果物の一致検査',
    results,
    { target: site.origin, startedAt, json: values.json },
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(USAGE);
  process.exitCode = 2;
}
