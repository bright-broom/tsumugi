/**
 * 文書の参照を検査する（npm run check で走る。監査 B05）。
 *
 *   1. Markdown のリンク（相対パス）が実在するか
 *   2. `npm run <名前>` が package.json にあるか
 *   3. 引用符で囲んだファイルの道筋（src/… tools/… など、拡張子つき）が実在するか
 *
 * 外部 URL・アンカーだけのリンク・ワイルドカードを含む道筋は見ない（通信しない）。
 * 当時の構造を記録した ADR や、これから作るファイルの手順書は、理由を書いて除外する：
 *
 *   <!-- check-docs: allow src/content/diagrams.ts （2026-09-15 に components/diagrams/ へ移した） -->
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ROOT } from '../paths';
import { documentProblems, type DocFile, type Entry } from './docs-references';

/** 見る文書。生成物・依存・作業用のフォルダは見ない。 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.artifacts',
  '.data',
  'out',
  'coverage',
  '.locale-build',
  '.vercel',
]);

const markdownFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    if (item.name.startsWith('.') && item.name !== '.github') return [];
    const full = join(dir, item.name);
    if (item.isDirectory()) return SKIP_DIRS.has(item.name) ? [] : markdownFiles(full);
    return item.isFile() && item.name.endsWith('.md') ? [full] : [];
  });

/** 大文字小文字を区別しないファイルシステムでも、綴りの違いを見つける。 */
const entry = (path: string): Entry => {
  const full = join(ROOT, path);
  const parent = full.slice(0, full.lastIndexOf(sep));
  const name = full.slice(parent.length + 1);
  try {
    if (name && !readdirSync(parent).includes(name)) return 'missing';
    return statSync(full).isDirectory() ? 'directory' : 'file';
  } catch {
    return 'missing';
  }
};

const files: DocFile[] = markdownFiles(ROOT).map((file) => ({
  path: relative(ROOT, file).split(sep).join('/'),
  text: readFileSync(file, 'utf8'),
}));
const scripts = Object.keys(
  (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: object }).scripts,
);

const problems = documentProblems(files, { scripts, entry });
if (problems.length) {
  console.error(`check-docs: 文書の参照が ${problems.length} 件合いません`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `check-docs: ${files.length} 件の文書のリンク・コマンド・ファイルの参照はすべて実在します`,
  );
}
