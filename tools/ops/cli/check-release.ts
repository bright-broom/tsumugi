/** 公開成果物と配信内容を照合する。比較元は必ず明示する。 */
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../../paths';
import { checkRelease } from '../release';
import { distFetch } from '../probe';
import { report } from '../results';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    dist: { type: 'string' },
    fingerprint: { type: 'string' },
    'served-dist': { type: 'string' },
    json: { type: 'string', default: join(ROOT, '.artifacts', 'ops', 'check-release.json') },
  },
});
try {
  if (!values.url || !values.dist)
    throw new Error(
      '使い方: npm run check:release -- --url https://<公開先> --dist <比較元成果物> [--fingerprint <SHA256>] [--served-dist <模擬配信元>] [--json <記録先>]',
    );
  const startedAt = new Date();
  const results = await checkRelease(values.url, resolve(values.dist), {
    expectedFingerprint: values.fingerprint,
    ...(values['served-dist'] ? { fetch: distFetch(resolve(values['served-dist'])) } : {}),
  });
  process.exitCode = report(
    values['served-dist'] ? '公開成果物の一致検査（模擬配信・通信なし）' : '公開成果物の一致検査',
    results,
    {
      target: values.url,
      startedAt,
      json: values.json,
    },
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
