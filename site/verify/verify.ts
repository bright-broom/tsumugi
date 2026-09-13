/**
 * 標準仕様の自動検証 ── これが「納品する仕様」の実体。
 * 1つでも FAIL があれば納品しない。顧客サイトにも同じ検査をかける。
 *
 *   npm run verify                      静的＋ブラウザ検証（out/ を検査する）
 *   npm run verify -- --static          静的のみ（ブラウザ不要・CI向け）
 *   npm run verify -- --write           LCP実測値を src/data/config.ts に書き戻す
 *   npm run verify -- --dist <path>     検査するディレクトリを差し替える
 *
 * 出力: 標準出力のレポート ＋ <dist>/../verify-report.json
 *       （--static のときは verify-report.static.json。ページに出す件数は全項目の結果からだけ取るので、
 *         簡易版を回しても works.html の「581項目」が「359項目」に落ちない）
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { checkBrowser } from './browser';
import { R, type Result } from './results';
import { checkStatic } from './static';

const ROOT = join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const arg = (flag: string, fallback: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : fallback;
};
const DIST = resolve(arg('--dist', join(ROOT, 'out')));
const STATIC_ONLY = argv.includes('--static');
const REPORT = STATIC_ONLY ? 'verify-report.static.json' : 'verify-report.json';

function report(): number {
  const count = (level: Result['level']) => R.filter((r) => r.level === level).length;
  const [passes, warns, fails] = [count('PASS'), count('WARN'), count('FAIL')];

  // チェック名ごとに集約して、FAIL → WARN → PASS の順に表示
  const by = new Map<string, Result[]>();
  for (const r of R) {
    const rows = by.get(r.check);
    if (rows) rows.push(r);
    else by.set(r.check, [r]);
  }
  const rank = (rows: Result[]) =>
    rows.some((r) => r.level === 'FAIL') ? 0 : rows.some((r) => r.level === 'WARN') ? 1 : 2;
  const checks = [...by.keys()].sort((a, b) => rank(by.get(a)!) - rank(by.get(b)!) || (a < b ? -1 : a > b ? 1 : 0));

  const rule = (c: string) => c.repeat(74);
  console.log('\n' + rule('='));
  console.log('  標準仕様の自動検証レポート');
  console.log(rule('='));
  for (const chk of checks) {
    const rows = by.get(chk)!;
    const nf = rows.filter((r) => r.level === 'FAIL').length;
    const nw = rows.filter((r) => r.level === 'WARN').length;
    const mark = nf ? 'FAIL' : nw ? 'WARN' : ' ok ';
    console.log(`\n[${mark}] ${chk}  (${rows.length - nf - nw}/${rows.length} pass)`);
    const shown = rows.filter((r) => r.level !== 'PASS').slice(0, 6);
    if (!shown.length) {
      const sample = rows.find((r) => r.detail)?.detail;
      if (sample) console.log(`        例: ${sample}`);
    }
    for (const r of shown) console.log(`        ${r.level} ${r.page}: ${r.detail}`);
  }

  const verdict = fails ? '納品不可' : '納品可';
  console.log('\n' + rule('-'));
  console.log(`  PASS ${passes}   WARN ${warns}   FAIL ${fails}`);
  console.log(rule('-'));
  console.log(`  判定: ${verdict}`);
  if (fails) console.log('  FAIL が1件でもあれば納品しません。上の指摘を直してから再実行してください。');
  console.log(rule('=') + '\n');

  writeFileSync(join(dirname(DIST), REPORT), JSON.stringify({
    verdict, pass: passes, warn: warns, fail: fails,
    results: R.map(({ level, check, page, detail }) => ({ level, check, page, detail })),
  }, null, 2));
  return fails ? 1 : 0;
}

checkStatic(DIST);
if (!STATIC_ONLY) await checkBrowser(DIST, ROOT, argv.includes('--write'));
process.exit(report());
