/** Next and Tailwind share one lifecycle; no orphan watcher after Ctrl+C. */
import { spawn, type ChildProcess } from 'node:child_process';
import { watch, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { renderTokensCss, TOKENS_OUT, TOKENS_SRC } from './build-tokens';
import { startStyles } from './build-styles';

import { ROOT } from '../paths';
const require = createRequire(import.meta.url);
writeFileSync(TOKENS_OUT, renderTokensCss().css);
await import('./build-public');

const children: ChildProcess[] = [];
let stopping = false;
let debounce: ReturnType<typeof setTimeout> | undefined;
const tokenWatcher = watch(dirname(TOKENS_SRC), (_event, filename) => {
  if (filename !== 'design.tokens.json') return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    try {
      writeFileSync(TOKENS_OUT, renderTokensCss().css);
    } catch (error) {
      console.error('Theme tokens:', error);
    }
  }, 80);
});

function stop(code: number) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  clearTimeout(debounce);
  tokenWatcher.close();
  for (const child of children) child.kill('SIGTERM');
  const timeout = setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  }, 5000);
  timeout.unref();
}

function supervise(child: ChildProcess) {
  children.push(child);
  child.once('error', (error) => {
    console.error(error);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    if (!stopping) stop(code ?? (signal ? 1 : 0));
  });
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
supervise(startStyles(undefined, undefined, true));
supervise(
  spawn(
    process.execPath,
    [require.resolve('next/dist/bin/next'), 'dev', ...process.argv.slice(2)],
    {
      cwd: ROOT,
      stdio: 'inherit',
    },
  ),
);
