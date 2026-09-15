/**
 * 社内ツールのデータ置き場。実データは git 管理外の `.data/` に置く（ADR 0036）。
 * 書き込み先がリポジトリの追跡対象のディレクトリになる指定は拒否する。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { ROOT } from '../../paths';

export class OpsError extends Error {}

/** 顧客 ID・案件 ID など。ファイル名に使うので、区切り文字や `..` を通さない。 */
export const idSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'ID は英小文字・数字・ハイフン（先頭は英数字、63 文字まで）');

const UNTRACKED = ['.data', '.artifacts'];

/** `--data` → 環境変数 `TSUMUGI_DATA_DIR` → `<repo>/.data` の順に決める。 */
export function resolveDataDir(flag: string | undefined): string {
  const dir = resolve(flag ?? process.env.TSUMUGI_DATA_DIR ?? join(ROOT, '.data'));
  const rel = relative(ROOT, dir);
  const outside = rel.startsWith('..') || isAbsolute(rel);
  if (!outside && !UNTRACKED.includes(rel.split(sep)[0] ?? ''))
    throw new OpsError(
      `データの置き場所がリポジトリの追跡対象です: ${rel || '.'}（.data/ か .artifacts/、またはリポジトリ外を指定してください）`,
    );
  return dir;
}

/** `--out` で指定した書き出し先にも同じ制限をかける。顧客名入りの書面を追跡対象に置かない。 */
export function resolveOutputFile(file: string): string {
  resolveDataDir(dirname(resolve(file)));
  return resolve(file);
}

export function readJson<T>(file: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new OpsError(`${file}: JSON を読めません（${(error as Error).message}）`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success)
    throw new OpsError(
      `${file}: 形式が違います\n  ${result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('\n  ')}`,
    );
  return result.data;
}

export function readJsonIfExists<T>(file: string, schema: z.ZodType<T>): T | null {
  return existsSync(file) ? readJson(file, schema) : null;
}

/** 途中で止まっても壊れたファイルを残さないよう、一時ファイルに書いてから置き換える。 */
export function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  renameSync(temp, file);
}

export function writeText(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, file);
}
