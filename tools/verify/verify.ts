/**
 * 標準仕様の自動検証 ── これが「納品する仕様」の実体。
 * 1つでも FAIL があれば納品しない。顧客サイトにも同じ検査をかける。
 *
 *   npm run verify                      静的＋ブラウザ検証（out/ を検査する）
 *   npm run verify -- --static          静的のみ（ブラウザ不要・CI向け）
 *   npm run verify -- --mode production 本番の公開条件で検査する（既定は preview。VERCEL_ENV=production なら本番）
 *   npm run verify -- --write           LCP実測値と記録日を src/content/measurements.ts に書き戻す
 *   npm run verify -- --dist <path>     検査するディレクトリを差し替える
 *
 * 出力: 標準出力のレポート ＋ .artifacts/verification/verify-report.json
 *       （--static のときは verify-report.static.json）。レポートには測定日時・対象コミットと未コミットの変更の有無・
 *       成果物の指紋・検査の種別とモード・件数・仕様20項目の受入状況を入れる。
 *       ページ（works.html）が件数を出すのは、全項目・FAIL 0・ビルドと同じコミットのレポートだけ（ADR 0025）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gitRunner, resolveCommit } from '@/lib/build-commit';
import { tokyoDate } from '@/lib/verification-report';
import { acceptanceEntries, auditAcceptance } from './acceptance';
import { checkBrowser } from './browser';
import { resolveMode } from './publication';
import { artifactFingerprint, buildReport, printReport } from './report';
import { R, rec } from './results';
import { checkStatic } from './static';

import { ROOT, VERIFICATION_DIR } from '../paths';
const argv = process.argv.slice(2);
const arg = (flag: string, fallback: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : fallback;
};
const DIST = resolve(arg('--dist', join(ROOT, 'out')));
const STATIC_ONLY = argv.includes('--static');
const REPORT = STATIC_ONLY ? 'verify-report.static.json' : 'verify-report.json';

const modeAt = argv.indexOf('--mode');
const modeFlag = modeAt < 0 ? undefined : argv[modeAt + 1] && !argv[modeAt + 1]!.startsWith('--') ? argv[modeAt + 1]! : null;
const resolved = resolveMode(modeFlag, process.env);
if ('error' in resolved) {
  console.error(`verify: ${resolved.error}`);
  process.exit(2);
}
const MODE = resolved.mode;

checkStatic(DIST, MODE);
const lcp = STATIC_ONLY ? null : await checkBrowser(DIST, ROOT, argv.includes('--write'));
for (const f of auditAcceptance(R, !STATIC_ONLY)) rec(f.level, f.check, f.page, f.detail);

const measuredAt = new Date();
const report = buildReport({
  results: R,
  kind: STATIC_ONLY ? 'static' : 'full',
  mode: MODE,
  measuredAt,
  // 検査のあとで判定する（--write が measurements.ts を書き換えたら、未コミットの変更ありになる）
  commit: resolveCommit(process.env, gitRunner(ROOT)),
  artifact: artifactFingerprint(DIST),
  lcp,
  acceptance: acceptanceEntries(R, !STATIC_ONLY, tokyoDate(measuredAt)),
});
printReport(report);
mkdirSync(VERIFICATION_DIR, { recursive: true });
writeFileSync(join(VERIFICATION_DIR, REPORT), JSON.stringify(report, null, 2));
process.exit(report.counts.fail ? 1 : 0);
