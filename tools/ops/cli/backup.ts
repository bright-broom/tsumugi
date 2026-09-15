/**
 * バックアップを作る（#31、ADR 0045）。
 *
 *     npm run backup                         .artifacts/backup/tsumugi-<日時>-<commit>/ に書く
 *     npm run backup -- --out <dir>
 *
 * 出力：repo.bundle（HEAD までの全履歴）・manifest.json（ファイルごとの SHA-256）・SHA256SUMS。
 * 未コミットの変更、追跡してはいけないファイル、秘密情報の形の文字列があれば作らずに止まる。
 */
import { appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../../paths';
import { createBackup } from '../backup';

const { values } = parseArgs({
  options: { out: { type: 'string', default: join(ROOT, '.artifacts', 'backup') } },
});

try {
  const { dir, manifest } = createBackup({ root: ROOT, outDir: resolve(values.out) });
  const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
  console.log(`commit ${manifest.commit}（${manifest.ref}）`);
  for (const [category, total] of Object.entries(manifest.totals))
    console.log(
      `  ${category.padEnd(9)}${String(total.files).padStart(5)} ファイル ${kib(total.bytes).padStart(12)}`,
    );
  console.log(`  bundle   ${kib(manifest.bundle.bytes).padStart(24)}`);
  console.log(`バックアップ: ${dir}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `dir=${dir}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
