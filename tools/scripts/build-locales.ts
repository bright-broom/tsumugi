/**
 * 追加言語のビルド（ADR 0081）。既定言語の out/ を作った後に、PUBLISHED_LOCALES の 2 番目以降を
 * 別の出力先でビルド・検査し、HTML を out/<言語のパス>/ へ統合する。言語が 1 つなら何もしない。
 * テーマ・画像・フォントは既定言語の out/ のものを共有し、言語ごとに複製しない。
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { PUBLISHED_LOCALES } from '@/content/config';
import { LOCALE_SETTINGS, type LocaleId } from '@/lib/locale';
import { ROOT } from '../paths';

const OUT = join(ROOT, 'out');
const WORK = '.locale-build';

/** 書き出した HTML（言語の出力先の中で、Next の作業用ディレクトリを除く） */
export function localeHtmlFiles(dir: string, prefix = ''): string[] {
  const skip = new Set(['_next', 'cache', 'server', 'static', 'types', 'diagnostics']);
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? skip.has(entry.name) && !prefix
        ? []
        : localeHtmlFiles(join(dir, entry.name), `${prefix}${entry.name}/`)
      : entry.name.endsWith('.html')
        ? [`${prefix}${entry.name}`]
        : [],
  );
}

function run(command: string, args: string[], env: Record<string, string>) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} が失敗しました`);
}

export function buildLocale(locale: LocaleId) {
  const base = LOCALE_SETTINGS[locale].basePath.replace(/^\//, '');
  if (!base) throw new Error(`${locale} は既定言語のパスです`);
  const dist = join(WORK, locale);
  rmSync(join(ROOT, dist), { recursive: true, force: true });
  const env = { SITE_LOCALE: locale, NEXT_DIST_DIR: dist };
  run(join(ROOT, 'node_modules', '.bin', 'next'), ['build'], env);
  run(join(ROOT, 'node_modules', '.bin', 'tsx'), ['tools/scripts/postbuild.ts'], env);
  const target = join(OUT, base);
  rmSync(target, { recursive: true, force: true });
  const files = localeHtmlFiles(join(ROOT, dist));
  for (const file of files) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    cpSync(join(ROOT, dist, file), join(target, file));
  }
  console.log(
    `build-locales: ${locale} の ${files.length} ページを ${relative(ROOT, target)}/ へ統合しました`,
  );
}

if (process.argv[1]?.endsWith('build-locales.ts')) {
  if (!existsSync(OUT)) throw new Error('out/ がありません。先に既定言語をビルドしてください');
  for (const locale of PUBLISHED_LOCALES.slice(1)) buildLocale(locale);
}
