/**
 * 運用コマンド（公開後の確認・監視）の結果を、標準出力・JSON・GitHub のジョブ要約へ同じ形で出す。
 * 納品物の検査（tools/verify/）とは独立させ、あちらの改修と衝突しないようにしている。
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type Status = 'PASS' | 'WARN' | 'FAIL' | 'SKIP';

export interface CheckResult {
  status: Status;
  name: string;
  detail: string;
}

export const result = (status: Status, name: string, detail: string): CheckResult => ({
  status,
  name,
  detail,
});

export function tally(results: readonly CheckResult[]): Record<Status, number> {
  const counts: Record<Status, number> = { PASS: 0, WARN: 0, FAIL: 0, SKIP: 0 };
  for (const entry of results) counts[entry.status] += 1;
  return counts;
}

const summaryLine = (counts: Record<Status, number>) =>
  `PASS ${counts.PASS} / WARN ${counts.WARN} / FAIL ${counts.FAIL} / SKIP ${counts.SKIP}`;

function toMarkdown(title: string, results: readonly CheckResult[]): string {
  const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  return [
    `### ${title}`,
    '',
    summaryLine(tally(results)),
    '',
    '| 結果 | 項目 | 内容 |',
    '|---|---|---|',
    ...results.map((entry) => `| ${entry.status} | ${cell(entry.name)} | ${cell(entry.detail)} |`),
    '',
  ].join('\n');
}

interface ReportOptions {
  target: string;
  startedAt: Date;
  json?: string;
}

/** 結果を出力し、終了コード（FAIL が1件でもあれば 1）を返す。 */
export function report(title: string, results: readonly CheckResult[], options: ReportOptions) {
  for (const entry of results)
    console.log(`${entry.status.padEnd(4)}  ${entry.name}: ${entry.detail}`);
  const counts = tally(results);
  console.log(`\n${title}（${options.target}）: ${summaryLine(counts)}`);
  if (options.json) {
    mkdirSync(dirname(options.json), { recursive: true });
    const body = {
      title,
      target: options.target,
      startedAt: options.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      counts,
      results,
    };
    writeFileSync(options.json, `${JSON.stringify(body, null, 2)}\n`);
    console.log(`結果: ${options.json}`);
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, `${toMarkdown(`${title}（${options.target}）`, results)}\n`);
  return counts.FAIL > 0 ? 1 : 0;
}
