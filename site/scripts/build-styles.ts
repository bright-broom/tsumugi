/** Compile the central Tailwind stylesheet without adding browser JavaScript. */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const CLI = join(dirname(require.resolve('@tailwindcss/cli/package.json')), 'dist/index.mjs');

export function startStyles(
  input = 'styles/globals.css',
  output = 'public/theme.css',
  watch = false,
) {
  mkdirSync(dirname(resolve(ROOT, output)), { recursive: true });
  return spawn(
    process.execPath,
    [CLI, '-i', input, '-o', output, ...(watch ? ['--watch=always'] : [])],
    {
      cwd: ROOT,
      stdio: 'inherit',
    },
  );
}

export async function buildStyles(input?: string, output?: string): Promise<void> {
  await new Promise<void>((ok, fail) => {
    const child = startStyles(input, output);
    child.once('error', fail);
    child.once('exit', (code, signal) =>
      code === 0 ? ok() : fail(new Error(`Tailwind failed: ${signal ?? code}`)),
    );
  });
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--watch')) {
    const child = startStyles(undefined, undefined, true);
    process.once('SIGINT', () => child.kill('SIGINT'));
    process.once('SIGTERM', () => child.kill('SIGTERM'));
    child.once('error', (error) => {
      console.error(error);
      process.exitCode = 1;
    });
    child.once('exit', (code) => {
      process.exitCode = code ?? 0;
    });
  } else await buildStyles();
}
