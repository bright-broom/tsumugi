import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAGIC,
  backupName,
  checkPassphrase,
  collectFiles,
  expired,
  open,
  restoreInto,
  seal,
} from '../tools/ops/private-backup';

const ROOT = join(import.meta.dirname, '..');
// テストでは鍵の計算を軽くする（本番の既定は N=2^17）
const kdf = { N: 2 ** 10, r: 8, p: 1 };
const PASS = 'correct horse battery';
const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const tempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
};

/** 架空の業務データ（顧客・請求・振込先の設定）。 */
function fixtureData() {
  const dir = tempDir('tsumugi-private-data-');
  mkdirSync(join(dir, 'crm'), { recursive: true });
  mkdirSync(join(dir, 'billing', 'sample-shop'), { recursive: true });
  writeFileSync(join(dir, 'crm', 'sample-shop.json'), '{"customerId":"sample-shop"}\n');
  writeFileSync(join(dir, 'billing', 'profile.json'), '{"bank":"架空銀行"}\n');
  writeFileSync(join(dir, 'billing', 'sample-shop', 'invoices.json'), '[]\n');
  writeFileSync(join(dir, '.ops-lock'), '{"pid":1}\n');
  writeFileSync(join(dir, 'crm', 'x.json.abc.tmp'), 'partial');
  return dir;
}

describe('業務データの暗号化バックアップ（ADR 0088）', () => {
  it('まとめて暗号化し、復号して全ファイルを同じ中身で取り出せる', () => {
    const data = fixtureData();
    const entries = collectFiles(data);
    // ロックと書きかけの一時ファイルは写さない
    expect(entries.map((e) => e.path)).toEqual([
      'billing/profile.json',
      'billing/sample-shop/invoices.json',
      'crm/sample-shop.json',
    ]);
    const file = seal(entries, PASS, { kdf, now: new Date('2026-09-26T01:02:03Z') });
    expect(file.subarray(0, MAGIC.length).equals(MAGIC)).toBe(true);
    // 中身は平文で読めない
    expect(file.includes(Buffer.from('架空銀行'))).toBe(false);
    expect(file.includes(Buffer.from('sample-shop'))).toBe(false);

    const opened = open(file, PASS);
    expect(opened.createdAt).toBe('2026-09-26T01:02:03.000Z');
    const target = join(tempDir('tsumugi-private-restore-'), 'data');
    restoreInto(opened.entries, target);
    for (const entry of entries)
      expect(readFileSync(join(target, entry.path)).equals(entry.data)).toBe(true);
  });

  it('パスフレーズが違う・本文やヘッダーを書き換えた・形式が違うものは戻さない', () => {
    const file = seal(collectFiles(fixtureData()), PASS, { kdf });
    expect(() => open(file, 'wrong passphrase!')).toThrow('復号できません');
    const body = Buffer.from(file);
    body[body.length - 40]! ^= 0xff;
    expect(() => open(body, PASS)).toThrow('復号できません');
    // ヘッダー（作成日時）の書き換えも、認証の対象なので検出する
    const header = Buffer.from(
      file.toString('latin1').replace('"createdAt":"2', '"createdAt":"1'),
      'latin1',
    );
    expect(() => open(header, PASS)).toThrow('復号できません');
    expect(() => open(Buffer.from('not a backup at all, just text'), PASS)).toThrow('壊れています');
  });

  it('復号できても、中身の SHA-256 やパスが不正なら取り出さない', () => {
    // 正しい鍵で暗号化した、細工した中身（フォルダの外へ書くパス・改ざんした内容）
    const craft = (files: object[]) => {
      const salt = randomBytes(16);
      const iv = randomBytes(12);
      const headerBytes = Buffer.from(
        JSON.stringify({
          format: 1,
          cipher: 'aes-256-gcm',
          kdf: { name: 'scrypt', ...kdf },
          salt: salt.toString('base64'),
          iv: iv.toString('base64'),
          createdAt: '2026-09-26T00:00:00.000Z',
          files: files.length,
        }),
      );
      const key = scryptSync(PASS, salt, 32, { ...kdf, maxmem: 256 * kdf.N * kdf.r });
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(headerBytes);
      const plain = gzipSync(JSON.stringify({ createdAt: '2026-09-26T00:00:00.000Z', files }));
      const body = Buffer.concat([cipher.update(plain), cipher.final()]);
      const length = Buffer.alloc(4);
      length.writeUInt32BE(headerBytes.length);
      return Buffer.concat([MAGIC, length, headerBytes, body, cipher.getAuthTag()]);
    };
    const data = Buffer.from('x');
    const sha = '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881';
    expect(() =>
      open(
        craft([{ path: '../escape.json', bytes: 1, sha256: sha, data: data.toString('base64') }]),
        PASS,
      ),
    ).toThrow('取り出せないパス');
    expect(() =>
      open(
        craft([
          { path: 'a.json', bytes: 1, sha256: '0'.repeat(64), data: data.toString('base64') },
        ]),
        PASS,
      ),
    ).toThrow('SHA-256 が一致しません');
  });

  it('リンク・空でない取り出し先・短いパスフレーズは止める', () => {
    const data = fixtureData();
    symlinkSync('/etc/hosts', join(data, 'link.json'));
    expect(() => collectFiles(data)).toThrow('リンクがあります');

    const occupied = tempDir('tsumugi-private-occupied-');
    writeFileSync(join(occupied, 'keep.json'), '{}');
    expect(() => restoreInto([{ path: 'a.json', data: Buffer.from('{}') }], occupied)).toThrow(
      '空ではありません',
    );
    expect(readFileSync(join(occupied, 'keep.json'), 'utf8')).toBe('{}');

    expect(() => checkPassphrase(undefined)).toThrow('TSUMUGI_BACKUP_PASSPHRASE');
    expect(() => checkPassphrase('short')).toThrow('12 文字以上');
    expect(checkPassphrase(PASS)).toBe(PASS);
  });

  it('世代の整理は、このコマンドが作った名前だけを古い順に対象にする', () => {
    const names = [
      backupName(new Date('2026-09-01T00:00:00Z')),
      backupName(new Date('2026-09-08T00:00:00Z')),
      backupName(new Date('2026-09-15T00:00:00Z')),
      'notes.txt',
      'tsumugi-data-latest.tsmg',
    ];
    expect(expired(names, 2)).toEqual(['tsumugi-data-20260901T000000Z.tsmg']);
    expect(expired(names, 12)).toEqual([]);
    expect(() => expired(names, 0)).toThrow('--keep');
  });
});

describe('backup:private コマンド', () => {
  const cli = (args: string[], env: Record<string, string> = {}) =>
    spawnSync('node', ['--import', 'tsx', join(ROOT, 'tools/ops/cli/private-backup.ts'), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, TSUMUGI_BACKUP_PASSPHRASE: '', ...env },
    });

  it(
    '作成（読み戻しの照合つき）→ 照合 → 空のフォルダへの取り出し → 世代の整理',
    { timeout: 60_000 },
    () => {
      const data = fixtureData();
      rmSync(join(data, '.ops-lock')); // 他の社内操作は動いていない
      const out = tempDir('tsumugi-private-out-');
      const env = { TSUMUGI_BACKUP_PASSPHRASE: PASS };
      const created = cli(['create', '--data', data, '--out', out], env);
      expect(created.status, created.stderr).toBe(0);
      expect(created.stdout).toContain('3 ファイル');
      expect(created.stdout).toContain('SHA-256 が一致');
      const [file] = readdirSync(out);
      expect(file).toMatch(/^tsumugi-data-\d{8}T\d{6}Z\.tsmg$/);
      // 作成中に取ったロックは、終わったら残さない（他の社内操作を妨げない）
      expect(existsSync(join(data, '.ops-lock'))).toBe(false);

      expect(cli(['verify', '--file', join(out, file!)], env).status).toBe(0);
      const target = join(tempDir('tsumugi-private-to-'), 'data');
      const restored = cli(['restore', '--file', join(out, file!), '--to', target], env);
      expect(restored.status, restored.stderr).toBe(0);
      expect(readFileSync(join(target, 'billing', 'profile.json'), 'utf8')).toContain('架空銀行');

      writeFileSync(join(out, backupName(new Date('2020-01-01T00:00:00Z'))), 'old');
      const pruned = cli(['prune', '--out', out, '--keep', '1']);
      expect(pruned.status).toBe(0);
      expect(readdirSync(out)).toEqual([file]);
    },
  );

  it('パスフレーズがない・保管先がデータの中・違うパスフレーズでは、終了コード 1 で止まる', () => {
    const data = fixtureData();
    const out = tempDir('tsumugi-private-out-');
    const none = cli(['create', '--data', data, '--out', out]);
    expect(none.status).toBe(1);
    expect(none.stderr).toContain('TSUMUGI_BACKUP_PASSPHRASE');
    const env = { TSUMUGI_BACKUP_PASSPHRASE: PASS };
    const inside = cli(['create', '--data', data, '--out', join(data, 'backups')], env);
    expect(inside.status).toBe(1);
    expect(inside.stderr).toContain('データの置き場所の中');
    // 既にあるロックは他の社内操作の実行中を意味するので、読み取り途中の状態を写さずに止まる（ADR 0072）
    const locked = cli(['create', '--data', data, '--out', out], env);
    expect(locked.status).toBe(1);
    expect(locked.stderr).toContain('実行中');
    expect(readdirSync(out)).toEqual([]);
    rmSync(join(data, '.ops-lock'));
    expect(cli(['create', '--data', data, '--out', out], env).status).toBe(0);
    const [file] = readdirSync(out);
    const wrong = cli(['verify', '--file', join(out, file!)], {
      TSUMUGI_BACKUP_PASSPHRASE: 'another passphrase',
    });
    expect(wrong.status).toBe(1);
    expect(wrong.stderr).toContain('復号できません');
  });
});
