/**
 * 検査レポートの組み立てと表示（#34、ADR 0025）。
 * 形は src/lib/verification-report.ts のスキーマ。ページはこのレポートを zod で検証してから読む。
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  REPORT_SCHEMA_VERSION,
  tally,
  type AcceptanceEntry,
  type CommitInfo,
  type VerificationReport,
} from '@/lib/verification-report';
import type { VerifyMode } from './publication';
import type { Result } from './results';

/** 検査した成果物の指紋。相対パスと各ファイルの SHA-256 を名前順に連ねて、もう一度 SHA-256 をとる */
export function artifactFingerprint(dist: string): VerificationReport['artifact'] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push(relative(dist, p).split(sep).join('/'));
    }
  };
  if (existsSync(dist)) walk(dist);
  const all = createHash('sha256');
  for (const f of files.sort()) {
    all.update(`${f}\0${createHash('sha256').update(readFileSync(join(dist, f))).digest('hex')}\n`);
  }
  return { files: files.length, sha256: all.digest('hex') };
}

export function buildReport(input: {
  results: readonly Result[];
  kind: VerificationReport['kind'];
  mode: VerifyMode;
  measuredAt: Date;
  commit: CommitInfo;
  artifact: VerificationReport['artifact'];
  lcp: VerificationReport['lcp'];
  acceptance: AcceptanceEntry[];
}): VerificationReport {
  const counts = tally(input.results);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    kind: input.kind,
    mode: input.mode,
    measuredAt: input.measuredAt.toISOString(),
    commit: input.commit,
    artifact: input.artifact,
    counts,
    verdict: counts.fail ? 'blocked' : 'deliverable',
    lcp: input.lcp,
    acceptance: input.acceptance,
    results: input.results.map(({ level, check, page, detail }) => ({ level, check, page, detail })),
  };
}

export function printReport(report: VerificationReport): void {
  const results = report.results;
  // チェック名ごとに集約して、FAIL → WARN → PASS → 対象なし の順に表示
  const by = new Map<string, Result[]>();
  for (const r of results) {
    const rows = by.get(r.check);
    if (rows) rows.push(r);
    else by.set(r.check, [r]);
  }
  const rank = (rows: Result[]) =>
    rows.some((r) => r.level === 'FAIL') ? 0
      : rows.some((r) => r.level === 'WARN') ? 1
        : rows.some((r) => r.level === 'PASS') ? 2 : 3;
  const checks = [...by.keys()].sort((a, b) => rank(by.get(a)!) - rank(by.get(b)!) || (a < b ? -1 : a > b ? 1 : 0));

  const rule = (c: string) => c.repeat(74);
  const kind = report.kind === 'full' ? '全項目（静的検査＋ブラウザ実測）' : '静的検査のみ';
  const mode = report.mode === 'production' ? '本番' : 'プレビュー';
  const { sha, source, dirty } = report.commit;
  const commit = sha
    ? `${sha.slice(0, 12)}（${source}・未コミットの変更 ${dirty === null ? '不明' : dirty ? 'あり' : 'なし'}）`
    : '不明';
  console.log('\n' + rule('='));
  console.log('  標準仕様の自動検証レポート');
  console.log(`  種別: ${kind} / モード: ${mode}`);
  console.log(`  測定: ${report.measuredAt} / コミット: ${commit}`);
  console.log(`  成果物: ${report.artifact.files}ファイル sha256 ${report.artifact.sha256.slice(0, 12)}`);
  console.log(rule('='));
  for (const chk of checks) {
    const rows = by.get(chk)!;
    const nf = rows.filter((r) => r.level === 'FAIL').length;
    const nw = rows.filter((r) => r.level === 'WARN').length;
    const np = rows.filter((r) => r.level === 'PASS').length;
    const mark = nf ? 'FAIL' : nw ? 'WARN' : np ? ' ok ' : 'n/a ';
    const na = rows.length - nf - nw - np;
    console.log(`\n[${mark}] ${chk}  (${np}/${rows.length} pass${na ? `・対象なし ${na}` : ''})`);
    const shown = rows.filter((r) => r.level === 'FAIL' || r.level === 'WARN').slice(0, 6);
    if (!shown.length) {
      const sample = rows.find((r) => r.detail)?.detail;
      if (sample) console.log(`        例: ${sample}`);
    }
    for (const r of shown) console.log(`        ${r.level} ${r.page}: ${r.detail}`);
  }

  const { pass, warn, fail, notApplicable } = report.counts;
  console.log('\n' + rule('-'));
  console.log(`  PASS ${pass}   WARN ${warn}   FAIL ${fail}   （対象なし ${notApplicable}）`);
  console.log(rule('-'));
  console.log(`  判定: ${report.verdict === 'blocked' ? '納品不可' : '納品可'}`);
  if (fail) console.log('  FAIL が1件でもあれば納品しません。上の指摘を直してから再実行してください。');
  console.log(rule('=') + '\n');
}
