/**
 * 検査レポートの組み立てと表示（#34、ADR 0025）。
 * 形は src/lib/verification-report.ts のスキーマ。ページはこのレポートを zod で検証してから読む。
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
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
    all.update(
      `${f}\0${createHash('sha256')
        .update(readFileSync(join(dist, f)))
        .digest('hex')}\n`,
    );
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
    results: input.results.map(({ level, check, page, detail }) => ({
      level,
      check,
      page,
      detail,
    })),
  };
}

/**
 * GitHub Actions のジョブ要約に、不合格と警告だけを書く（`$GITHUB_STEP_SUMMARY`）。
 * CI のログは 1 万行を超えることがあり、どの検査がどのページで落ちたのかを探しづらい。
 * 要約に出しておけば、チェックの画面から 1 手で読める。ローカルでは何もしない。
 */
export function writeJobSummary(report: VerificationReport): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const { pass, warn, fail, notApplicable } = report.counts;
  const kind = report.kind === 'full' ? '全項目' : '静的検査のみ';
  const mode = report.mode === 'production' ? '本番' : 'プレビュー';
  const cell = (text: string) => text.replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
  const lines = [
    `### 納品物の検査（${kind}・${mode}モード）`,
    '',
    `PASS ${pass} / WARN ${warn} / FAIL ${fail}（対象なし ${notApplicable}）`,
    '',
  ];
  const notable = report.results.filter((r) => r.level === 'FAIL' || r.level === 'WARN');
  if (notable.length) {
    lines.push('| 結果 | 検査 | ページ | 内容 |', '|---|---|---|---|');
    // 不合格を先に出す。長い検査でも、直すべき行が先頭に来る。
    for (const r of [...notable].sort((a, b) =>
      a.level === b.level ? 0 : a.level === 'FAIL' ? -1 : 1,
    ))
      lines.push(`| ${r.level} | ${cell(r.check)} | ${cell(r.page)} | ${cell(r.detail)} |`);
  } else {
    lines.push('不合格・警告はありません。');
  }
  appendFileSync(file, `${lines.join('\n')}\n\n`);
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
    rows.some((r) => r.level === 'FAIL')
      ? 0
      : rows.some((r) => r.level === 'WARN')
        ? 1
        : rows.some((r) => r.level === 'PASS')
          ? 2
          : 3;
  const checks = [...by.keys()].sort(
    (a, b) => rank(by.get(a)!) - rank(by.get(b)!) || (a < b ? -1 : a > b ? 1 : 0),
  );

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
  console.log(
    `  成果物: ${report.artifact.files}ファイル sha256 ${report.artifact.sha256.slice(0, 12)}`,
  );
  console.log(rule('='));
  for (const chk of checks) {
    const rows = by.get(chk)!;
    const nf = rows.filter((r) => r.level === 'FAIL').length;
    const nw = rows.filter((r) => r.level === 'WARN').length;
    const np = rows.filter((r) => r.level === 'PASS').length;
    const mark = nf ? 'FAIL' : nw ? 'WARN' : np ? ' ok ' : 'n/a ';
    const na = rows.length - nf - nw - np;
    console.log(`\n[${mark}] ${chk}  (${np}/${rows.length} pass${na ? `・対象なし ${na}` : ''})`);
    // CI ログだけでも全原因を解決できるよう、要対応の項目は省略しない。
    const shown = rows.filter((r) => r.level === 'FAIL' || r.level === 'WARN');
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
  console.log(
    `  判定: ${report.verdict === 'blocked' ? '納品不可' : '自動検査合格（未確認事項・公開条件は上記参照）'}`,
  );
  if (fail)
    console.log('  FAIL が1件でもあれば納品しません。上の指摘を直してから再実行してください。');
  console.log(rule('=') + '\n');
}
