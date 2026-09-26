/**
 * 業務データ（.data/）の暗号化バックアップ（監査 A08、ADR 0088）。
 *
 * 週次のバックアップ（backup.ts）はリポジトリの中身だけを対象にし、顧客・案件・見積・請求・入金の
 * 実データはどこにも残っていなかった。ここでは .data/ を 1 つの暗号化ファイルにまとめ、別の場所
 * （外付けディスク・オーナー名義のクラウド）へ写せるようにする。保管先は決めない（オーナーが決める）。
 *
 * 形式：MAGIC ＋ ヘッダー長（4 バイト）＋ ヘッダー（JSON）＋ 暗号文 ＋ 認証タグ（16 バイト）。
 * 中身は「ファイルごとの SHA-256 つきの一覧」を gzip したもの。暗号は AES-256-GCM、鍵はパスフレーズから
 * scrypt で作る。ヘッダーも認証の対象（AAD）にするので、ヘッダーの書き換えも検出する。
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, sep } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { z } from 'zod';
import { OpsError } from './shared/store';

export const MAGIC = Buffer.from('TSUMUGI-DATA-BACKUP/1\n');
const EXTENSION = '.tsmg';
const NAME = /^tsumugi-data-\d{8}T\d{6}Z\.tsmg$/;
/** 社内ツールの一時ファイル・ロック。写さない。 */
const SKIP = (path: string) => path === '.ops-lock' || path.endsWith('.tmp');

const MIN_PASSPHRASE = 12;
export interface Kdf {
  N: number;
  r: number;
  p: number;
}
/** 2^17：一般的な端末で 1 回あたり 1 秒弱。総当たりを遅らせるための既定値。 */
const DEFAULT_KDF: Kdf = { N: 2 ** 17, r: 8, p: 1 };

const headerSchema = z.object({
  format: z.literal(1),
  cipher: z.literal('aes-256-gcm'),
  kdf: z.object({
    name: z.literal('scrypt'),
    N: z.number().int().positive(),
    r: z.number().int().positive(),
    p: z.number().int().positive(),
  }),
  salt: z.string(),
  iv: z.string(),
  createdAt: z.string(),
  files: z.number().int().nonnegative(),
});
type Header = z.infer<typeof headerSchema>;

const entrySchema = z.object({
  path: z.string(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  data: z.string(),
});
const payloadSchema = z.object({ createdAt: z.string(), files: z.array(entrySchema) });
export type Entry = { path: string; data: Buffer };

const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');

/** 取り出したときにフォルダの外へ書かせない相対パスだけを通す。 */
function safePath(path: string): boolean {
  if (!path || isAbsolute(path) || path.includes('\\') || path.includes('\0')) return false;
  const normal = normalize(path);
  return normal === path && !normal.split(sep).some((part) => part === '..' || part === '');
}

export function checkPassphrase(passphrase: string | undefined): string {
  if (!passphrase)
    throw new OpsError(
      'パスフレーズを環境変数 TSUMUGI_BACKUP_PASSPHRASE で渡してください（引数には書かない。シェルの履歴に残るため）',
    );
  if ([...passphrase].length < MIN_PASSPHRASE)
    throw new OpsError(`パスフレーズは ${MIN_PASSPHRASE} 文字以上にしてください`);
  return passphrase;
}

/** .data/ の中の通常のファイルを集める。リンクは中身の所在が変わりうるので、写さずに止める。 */
export function collectFiles(dataDir: string): Entry[] {
  if (!existsSync(dataDir)) throw new OpsError(`データの置き場所がありません: ${dataDir}`);
  const entries: Entry[] = [];
  const links: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const path = relative(dataDir, full).split(sep).join('/');
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) links.push(path);
      else if (stat.isDirectory()) walk(full);
      else if (stat.isFile() && !SKIP(path)) entries.push({ path, data: readFileSync(full) });
    }
  };
  walk(dataDir);
  if (links.length)
    throw new OpsError(`データの置き場所にリンクがあります（写しません）:\n${links.join('\n')}`);
  return entries;
}

export function seal(
  entries: readonly Entry[],
  passphrase: string,
  options: { now?: Date; kdf?: Kdf } = {},
): Buffer {
  const bad = entries.filter((e) => !safePath(e.path)).map((e) => e.path);
  if (bad.length) throw new OpsError(`写せないパスがあります: ${bad.join(', ')}`);
  const createdAt = (options.now ?? new Date()).toISOString();
  const kdf = options.kdf ?? DEFAULT_KDF;
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const header: Header = {
    format: 1,
    cipher: 'aes-256-gcm',
    kdf: { name: 'scrypt', ...kdf },
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    createdAt,
    files: entries.length,
  };
  const headerBytes = Buffer.from(JSON.stringify(header));
  const payload = gzipSync(
    JSON.stringify({
      createdAt,
      files: entries.map((e) => ({
        path: e.path,
        bytes: e.data.length,
        sha256: digest(e.data),
        data: e.data.toString('base64'),
      })),
    }),
  );
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt, kdf), iv);
  cipher.setAAD(headerBytes);
  const body = Buffer.concat([cipher.update(payload), cipher.final()]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(headerBytes.length);
  return Buffer.concat([MAGIC, length, headerBytes, body, cipher.getAuthTag()]);
}

function deriveKey(passphrase: string, salt: Buffer, kdf: Kdf): Buffer {
  return scryptSync(passphrase.normalize('NFC'), salt, 32, {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    maxmem: 256 * kdf.N * kdf.r,
  });
}

/** 復号し、ファイルごとの SHA-256 まで照合して返す。 */
export function open(file: Buffer, passphrase: string): { createdAt: string; entries: Entry[] } {
  const broken = () => new OpsError('バックアップの形式ではないか、壊れています');
  if (file.length < MAGIC.length + 4 + 16 || !file.subarray(0, MAGIC.length).equals(MAGIC))
    throw broken();
  const length = file.readUInt32BE(MAGIC.length);
  const start = MAGIC.length + 4;
  if (start + length + 16 > file.length) throw broken();
  const headerBytes = file.subarray(start, start + length);
  let header: Header;
  try {
    header = headerSchema.parse(JSON.parse(headerBytes.toString('utf8')));
  } catch {
    throw broken();
  }
  const { N, r, p } = header.kdf;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(passphrase, Buffer.from(header.salt, 'base64'), { N, r, p }),
    Buffer.from(header.iv, 'base64'),
  );
  decipher.setAAD(headerBytes);
  decipher.setAuthTag(file.subarray(file.length - 16));
  let payload: z.infer<typeof payloadSchema>;
  try {
    const plain = Buffer.concat([
      decipher.update(file.subarray(start + length, file.length - 16)),
      decipher.final(),
    ]);
    payload = payloadSchema.parse(JSON.parse(gunzipSync(plain).toString('utf8')));
  } catch {
    throw new OpsError('復号できません（パスフレーズが違うか、ファイルが書き換えられています）');
  }
  const problems: string[] = [];
  const entries = payload.files.map((f) => {
    const data = Buffer.from(f.data, 'base64');
    if (!safePath(f.path)) problems.push(`${f.path}: 取り出せないパス`);
    else if (data.length !== f.bytes || digest(data) !== f.sha256)
      problems.push(`${f.path}: SHA-256 が一致しません`);
    return { path: f.path, data };
  });
  if (entries.length !== header.files) problems.push('ファイルの数がヘッダーと一致しません');
  if (problems.length) throw new OpsError(`中身の照合に失敗しました:\n${problems.join('\n')}`);
  return { createdAt: payload.createdAt, entries };
}

/** 空の（またはまだない）フォルダにだけ取り出す。今あるデータを上書きしない。 */
export function restoreInto(entries: readonly Entry[], target: string): void {
  if (existsSync(target) && readdirSync(target).length)
    throw new OpsError(
      `取り出し先が空ではありません: ${target}。今あるデータを上書きしないため、空のフォルダを指定してください`,
    );
  mkdirSync(target, { recursive: true, mode: 0o700 });
  for (const entry of entries) {
    if (!safePath(entry.path)) throw new OpsError(`取り出せないパス: ${entry.path}`);
    const file = join(target, entry.path);
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, entry.data, { mode: 0o600, flag: 'wx' });
  }
}

export const backupName = (now: Date) =>
  `tsumugi-data-${now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')}${EXTENSION}`;

/** 新しい順に keep 世代を残し、それより古いバックアップの名前を返す（このコマンドが作った名前だけ）。 */
export function expired(names: readonly string[], keep: number): string[] {
  if (!Number.isInteger(keep) || keep < 1) throw new OpsError('--keep は 1 以上の整数');
  return names
    .filter((name) => NAME.test(name))
    .sort()
    .reverse()
    .slice(keep);
}
