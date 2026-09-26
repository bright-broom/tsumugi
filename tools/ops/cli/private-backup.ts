/**
 * 業務データ（.data/）の暗号化バックアップ（ADR 0088）。使い方は docs/operations.md「業務データのバックアップ」。
 *
 *     TSUMUGI_BACKUP_PASSPHRASE=… npm run backup:private -- create  --out <保管先のフォルダ> [--data <データの置き場所>]
 *     TSUMUGI_BACKUP_PASSPHRASE=… npm run backup:private -- verify  --file <バックアップ>
 *     TSUMUGI_BACKUP_PASSPHRASE=… npm run backup:private -- restore --file <バックアップ> --to <空のフォルダ>
 *                                 npm run backup:private -- prune   --out <保管先のフォルダ> [--keep 12]
 */
import { readdirSync, readFileSync, realpathSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve, sep, isAbsolute } from 'node:path';
import { Args } from '../shared/cli';
import { withDataLock } from '../shared/lock';
import { OpsError, resolveDataDir, resolveOutputFile } from '../shared/store';
import {
  backupName,
  checkPassphrase,
  collectFiles,
  expired,
  open,
  restoreInto,
  seal,
} from '../private-backup';

const USAGE = `
TSUMUGI_BACKUP_PASSPHRASE=… npm run backup:private -- create  --out <保管先のフォルダ> [--data <データの置き場所>]
TSUMUGI_BACKUP_PASSPHRASE=… npm run backup:private -- verify  --file <バックアップ>
TSUMUGI_BACKUP_PASSPHRASE=… npm run backup:private -- restore --file <バックアップ> --to <空のフォルダ>
                            npm run backup:private -- prune   --out <保管先のフォルダ> [--keep 12]

.data/ を 1 つの暗号化ファイル（AES-256-GCM）にまとめる。パスフレーズは 12 文字以上で、
環境変数だけで渡す。パスフレーズをなくすと戻せないので、パスワード管理ツールに保管する。
`;

const within = (parent: string, child: string) => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
};
const real = (path: string) => {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  return realpathSync(path);
};
const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;

const commands: Record<string, (args: Args) => void> = {
  create(args) {
    const passphrase = checkPassphrase(process.env.TSUMUGI_BACKUP_PASSPHRASE);
    const dataDir = resolveDataDir(args.optional('data'));
    const out = resolve(args.required('out'));
    // 保管先を .data/ の中に置くと、次のバックアップが前のバックアップを含んで膨らみ続ける
    if (within(real(dataDir), real(out)))
      throw new OpsError('保管先をデータの置き場所の中にしないでください');
    const now = new Date();
    const file = resolveOutputFile(join(out, backupName(now)));
    withDataLock(dataDir, () => {
      const entries = collectFiles(dataDir);
      writeFileSync(file, seal(entries, passphrase, { now }), { mode: 0o600, flag: 'wx' });
      // 書いたものを読み戻して復号・照合し、使えるバックアップであることを確かめる
      const check = open(readFileSync(file), passphrase);
      const bytes = check.entries.reduce((sum, e) => sum + e.data.length, 0);
      console.log(`${check.entries.length} ファイル（${kib(bytes)}）を暗号化しました: ${file}`);
      console.log('読み戻して復号し、全ファイルの SHA-256 が一致することを確かめました');
    });
  },

  verify(args) {
    const passphrase = checkPassphrase(process.env.TSUMUGI_BACKUP_PASSPHRASE);
    const file = resolve(args.required('file'));
    const { createdAt, entries } = open(readFileSync(file), passphrase);
    console.log(
      `作成 ${createdAt}・${entries.length} ファイル。全ファイルの SHA-256 が一致しました`,
    );
  },

  restore(args) {
    const passphrase = checkPassphrase(process.env.TSUMUGI_BACKUP_PASSPHRASE);
    const file = resolve(args.required('file'));
    const target = resolveDataDir(args.required('to'));
    const { createdAt, entries } = open(readFileSync(file), passphrase);
    restoreInto(entries, target);
    console.log(
      `作成 ${createdAt} のバックアップから ${entries.length} ファイルを取り出しました: ${target}`,
    );
  },

  prune(args) {
    const out = resolve(args.required('out'));
    const keep = args.integer('keep', 12);
    const names = expired(readdirSync(out), keep);
    for (const name of names) rmSync(join(out, name));
    console.log(
      names.length
        ? `古いバックアップを ${names.length} 件消しました（新しい ${keep} 世代を残す）`
        : '消すものはありません',
    );
  },
};

const args = new Args(process.argv.slice(2));
const command = args.command ? commands[args.command] : undefined;
if (!command) {
  console.error(USAGE.trim());
  process.exitCode = args.command === undefined || args.command === 'help' ? 0 : 1;
} else {
  try {
    command(args);
  } catch (error) {
    if (!(error instanceof OpsError)) throw error;
    console.error(`エラー: ${error.message}`);
    process.exitCode = 1;
  }
}
