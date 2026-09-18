import {
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
  statSync,
  symlinkSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { withDataLock } from '../tools/ops/shared/lock';
import { ROOT } from '../tools/paths';

const dirs: string[] = [];
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 'tsumugi-lock-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const cli = (name: string, args: string[]) =>
  spawnSync(
    process.execPath,
    ['--import', 'tsx', join(ROOT, 'tools/ops', name, 'cli.ts'), ...args],
    { cwd: ROOT, encoding: 'utf8', timeout: 20_000 },
  );

describe('社内CLIの読み込みから保存までの排他', () => {
  it('所有者を記録し、正常終了で解放する', () => {
    const dir = fixture(),
      file = join(dir, '.ops-lock');
    withDataLock(dir, () => {
      const owner = JSON.parse(readFileSync(file, 'utf8'));
      expect(owner.pid).toBe(process.pid);
      expect(owner.host).toBeTruthy();
      expect(Number.isNaN(Date.parse(owner.startedAt))).toBe(false);
      expect(statSync(file).mode & 0o777).toBe(0o600);
    });
    expect(existsSync(file)).toBe(false);
  });

  it('処理が失敗しても解放して元のエラーを返す', () => {
    const dir = fixture();
    expect(() =>
      withDataLock(dir, () => {
        throw new Error('command failed');
      }),
    ).toThrow('command failed');
    expect(existsSync(join(dir, '.ops-lock'))).toBe(false);
    expect(() => withDataLock(dir, () => {})).not.toThrow();
  });

  it('重複実行はコールバックへ入らず、先行ロックを消さない', () => {
    const dir = fixture();
    let called = false;
    withDataLock(dir, () => {
      const before = readFileSync(join(dir, '.ops-lock'), 'utf8');
      expect(() =>
        withDataLock(dir, () => {
          called = true;
        }),
      ).toThrow('保存せず停止');
      expect(readFileSync(join(dir, '.ops-lock'), 'utf8')).toBe(before);
    });
    expect(called).toBe(false);
  });

  it.each(['estimate', 'requests', 'crm', 'metrics', 'report', 'leads', 'gbp'])(
    '別プロセスの%s CLIも読み込み前に止める',
    (name) => {
      const commands: Record<string, string> = {
        estimate: 'save',
        requests: 'init',
        crm: 'init',
        metrics: 'import',
        report: 'generate',
        leads: 'import',
        gbp: 'change',
      };
      const dir = fixture();
      withDataLock(dir, () => {
        const result = cli(name, [commands[name]!, '--data', dir]);
        expect(result.status, result.stderr).toBe(1);
        expect(result.stderr).toContain('保存せず停止');
        expect(existsSync(join(dir, '.ops-lock'))).toBe(true);
      });
    },
  );

  it('実CLIの初期化は競合時に変更せず、解放後に再実行できる', () => {
    const dir = fixture();
    const args = ['init', '--data', dir, '--customer', 'test', '--since', '2026-09-01'];
    withDataLock(dir, () => {
      expect(cli('requests', args).status).toBe(1);
    });
    const result = cli('requests', args);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(dir, '.ops-lock'))).toBe(false);
  });

  it('古い不正なロックも自動削除しない', () => {
    const dir = fixture(),
      file = join(dir, '.ops-lock');
    writeFileSync(file, 'stale or interrupted');
    expect(() => withDataLock(dir, () => {})).toThrow('前回のロック');
    expect(readFileSync(file, 'utf8')).toBe('stale or interrupted');
  });

  it('シンボリックリンク経由の同じ保存先も競合する', () => {
    const dir = fixture(),
      alias = join(fixture(), 'alias');
    symlinkSync(dir, alias);
    withDataLock(dir, () => {
      expect(() => withDataLock(alias, () => {})).toThrow('保存せず停止');
    });
  });

  it('既存の壊れたリンクを上書き/削除しない', () => {
    const dir = fixture(),
      file = join(dir, '.ops-lock');
    symlinkSync(join(dir, 'missing'), file);
    expect(() => withDataLock(dir, () => {})).toThrow('保存せず停止');
    expect(() => renameSync(file, join(dir, 'preserved'))).not.toThrow();
  });

  it('実行中に置き換えられたロックは削除しない', () => {
    const dir = fixture(),
      file = join(dir, '.ops-lock');
    withDataLock(dir, () => {
      renameSync(file, join(dir, 'original'));
      writeFileSync(file, 'replacement');
    });
    expect(readFileSync(file, 'utf8')).toBe('replacement');
  });

  it('helpはロックがあっても表示できる', () => {
    const dir = fixture();
    writeFileSync(join(dir, '.ops-lock'), 'stale');
    expect(cli('requests', ['help', '--data', dir]).status).toBe(0);
  });
});
