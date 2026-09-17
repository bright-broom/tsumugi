/** Local synchronous CLI transaction lock. Never remove an existing/stale lock automatically. */
import {
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { OpsError, resolveDataDir } from './store';

/** Hold across the entire synchronous command, including every read and write. */
export function withDataLock(dataDir: string, command: () => void): void {
  const dir = resolveDataDir(dataDir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(realpathSync(dir), '.ops-lock');
  let fd: number;
  try {
    fd = openSync(path, 'wx', 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    throw new OpsError(
      `別の社内操作が実行中、または前回のロックが残っています: ${path}。保存せず停止しました。実行終了後に再実行してください。残存時は運用手順に従い実行元の停止を確認してください`,
    );
  }
  const owned = fstatSync(fd);
  try {
    writeFileSync(
      fd,
      JSON.stringify({ pid: process.pid, host: hostname(), startedAt: new Date().toISOString() }) +
        '\n',
    );
    command();
  } finally {
    closeSync(fd);
    // A manually replaced file/link belongs to someone else; do not clean it up.
    let current;
    try {
      current = lstatSync(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (current?.isFile() && current.dev === owned.dev && current.ino === owned.ino) rmSync(path);
  }
}
