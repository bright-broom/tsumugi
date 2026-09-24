/**
 * 日付で表示が変わる日に、サイトを作り直す（監査 C08、ADR 0084）。
 *
 *     npm run refresh                          前日から今日までの境目を見る
 *     npm run refresh -- --today 2026-12-29 --since 2026-12-28
 *
 * 境目があれば終了コード 10（ワークフローが配備フックを叩く合図）、なければ 0。
 * 判定に失敗したら 2。ここからは通信も配備もしない。
 */
import { appendFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { STORE, STORE_AS_OF } from '@/content/store';
import { boundaries, describeBoundary, refreshDecision } from '../freshness';

const USAGE = '使い方: npm run refresh -- [--today YYYY-MM-DD] [--since YYYY-MM-DD]';
const DAY = 24 * 60 * 60 * 1000;

const { values } = parseArgs({
  options: {
    today: { type: 'string', default: STORE_AS_OF },
    since: { type: 'string' },
  },
});

try {
  const today = values.today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--today は YYYY-MM-DD: ${today}`);
  const since =
    values.since ??
    new Date(new Date(`${today}T00:00:00Z`).getTime() - DAY).toISOString().slice(0, 10);
  const found = boundaries(STORE, since, today);
  for (const boundary of found) console.log(`境目  ${describeBoundary(boundary)}`);
  const decision = refreshDecision(found, { since, today });
  console.log(decision.message);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `refresh=${decision.refresh ? 'yes' : 'no'}\n`);
  process.exitCode = decision.code;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(USAGE);
  process.exitCode = 2;
}
