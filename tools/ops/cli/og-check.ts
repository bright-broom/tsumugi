/**
 * OGP 画像の再現性の検査（#37、ADR 0047）。public/og/ は書き換えない。
 *
 *     npm run og:check                         一時ディレクトリに生成して public/og/ と比べ、生成物を消す
 *     npm run og:check -- --keep               生成物を残す（差分を目で確かめるとき）
 *     npm run og:check -- --generated <dir>    生成済みのディレクトリと比べるだけ
 *
 * 正本の生成環境は macOS（ヒラギノ角ゴシック）＋ Playwright 1.63.0 の Chromium。
 * ほかの OS では書体が変わって一致しないため、CI の必須検査にはしない。
 * 全ファイルがバイト一致なら終了コード 0、差分があれば 1、生成に失敗したら 2。
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../../paths';
import {
  OG_REFERENCE,
  compareDirs,
  currentEnvironment,
  hasDirectory,
  isIdentical,
  referenceGaps,
} from '../og-compare';

const { values } = parseArgs({
  options: {
    generated: { type: 'string' },
    keep: { type: 'boolean', default: false },
  },
});

const committed = join(ROOT, 'public', 'og');
const environment = currentEnvironment(ROOT);
console.log(
  `環境: ${environment.platform} ${environment.macOS ?? ''}・Playwright ${environment.playwright ?? '不明'}・Chromium ${environment.chromium ?? '不明'}`,
);
console.log(
  `正本: macOS ${OG_REFERENCE.macOS}・Playwright ${OG_REFERENCE.playwright}・Chromium ${OG_REFERENCE.chromium}・${OG_REFERENCE.fonts}`,
);
const gaps = referenceGaps(environment);
for (const gap of gaps) console.log(`  注意: ${gap}`);

let generated = values.generated ? resolve(values.generated) : '';
let exitCode = 0;
try {
  if (!generated) {
    generated = mkdtempSync(join(tmpdir(), 'tsumugi-og-check-'));
    const run = spawnSync(
      process.execPath,
      ['--import', 'tsx', join(ROOT, 'tools', 'scripts', 'og.ts'), '--out', generated],
      { cwd: ROOT, stdio: 'inherit' },
    );
    if (run.status !== 0) {
      console.error('OGP 画像の生成に失敗しました（Chromium の用意を確認してください）');
      exitCode = 2;
    }
  }
  if (exitCode === 0) {
    if (!hasDirectory(generated)) throw new Error(`比べるディレクトリがありません: ${generated}`);
    const comparison = compareDirs(committed, generated);
    for (const entry of comparison.different)
      console.log(`  差分  ${entry.file}（${entry.expectedBytes} → ${entry.actualBytes} バイト）`);
    for (const file of comparison.missing) console.log(`  未生成 ${file}`);
    for (const file of comparison.extra) console.log(`  余分  ${file}（public/og/ にない）`);
    if (isIdentical(comparison)) {
      console.log(`og:check: ${comparison.same.length} ファイルすべて public/og/ とバイト一致`);
    } else {
      exitCode = 1;
      console.log(
        `og:check: 一致 ${comparison.same.length}・差分 ${comparison.different.length}・未生成 ${comparison.missing.length}・余分 ${comparison.extra.length}`,
      );
      console.log(
        gaps.length
          ? '正本の環境と違うため、差分は書体・Chromium の違いによる可能性があります。public/og/ は変更していません'
          : '正本の環境で差分が出ました。文面・CSS の変更か確かめ、承認を得てから npm run og で更新してください。public/og/ は変更していません',
      );
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 2;
} finally {
  if (!values.generated && generated && !values.keep)
    rmSync(generated, { recursive: true, force: true });
  else if (!values.generated && generated) console.log(`生成物: ${generated}`);
}
process.exitCode = exitCode;
