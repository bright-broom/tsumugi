/**
 * バックアップの復元テスト（#31、ADR 0045）。
 *
 *     npm run backup:restore-test -- --backup <バックアップのディレクトリ>
 *         [--work <復元先の親>] [--deps ci|clone|link|none] [--build build|typecheck|none] [--keep] [--report <file>]
 *
 * 既定は、依存を npm ci で入れ直してビルドまで行う（別環境での復元と同じ条件）。
 * ディスクや通信を節約するときは、package-lock.json が同じ場合に限り、このリポジトリの node_modules を
 * --deps clone（macOS の APFS クローン。ビルド可）か --deps link（シンボリックリンク。Turbopack が拒否するため
 * --build typecheck まで）で使う。どちらも所要時間にインストールを含まない。結果は <バックアップ>/restore-report.json に書く。
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../../paths';
import { restoreTest, type BuildMode, type DepsMode } from '../restore';

const { values } = parseArgs({
  options: {
    backup: { type: 'string' },
    work: { type: 'string' },
    deps: { type: 'string', default: 'ci' },
    build: { type: 'string', default: 'build' },
    keep: { type: 'boolean', default: false },
    report: { type: 'string' },
  },
});

const pick = <T extends string>(value: string, allowed: readonly T[], flag: string): T => {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`${flag} は ${allowed.join(' / ')} のどれか: ${value}`);
};

try {
  if (!values.backup)
    throw new Error(
      '使い方: npm run backup:restore-test -- --backup <dir> [--deps ci|clone|link|none] [--build build|typecheck|none]',
    );
  const backupDir = resolve(values.backup);
  if (values.work) mkdirSync(resolve(values.work), { recursive: true });
  const workDir = mkdtempSync(
    join(values.work ? resolve(values.work) : tmpdir(), 'tsumugi-restore-'),
  );
  const report = restoreTest({
    backupDir,
    workDir,
    deps: pick<DepsMode>(values.deps, ['ci', 'clone', 'link', 'none'], '--deps'),
    build: pick<BuildMode>(values.build, ['build', 'typecheck', 'none'], '--build'),
    sourceRoot: ROOT,
    keep: values.keep,
  });
  for (const step of report.steps)
    console.log(
      `${step.ok ? 'OK  ' : 'FAIL'}  ${step.name}（${(step.ms / 1000).toFixed(1)} 秒）: ${step.detail}`,
    );
  console.log(
    `\n復元テスト: ${report.ok ? '成功' : '失敗'}・合計 ${(report.totalMs / 1000).toFixed(1)} 秒（deps=${report.deps}、build=${report.build}）`,
  );
  const file = values.report ? resolve(values.report) : join(backupDir, 'restore-report.json');
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`記録: ${file}${values.keep ? `\n復元先: ${join(workDir, 'repo')}` : ''}`);
  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
