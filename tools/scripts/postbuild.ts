import { spaceHtml } from '@/i18n/html-typography';
/**
 * next build の後始末と、「実行時JS 0バイト」の番人。
 *
 * 0. Next が head に付ける印（data-next-head=""・空の <noscript data-n-css>）を消す。
 *    JS で head を差し替えるための印で、JS を配らない以上は役目がない。
 *    残すと `<title>` や `<script type="application/ld+json">` の照合（verify）が外れる。
 * 1. どの HTML にも JSON-LD 以外の <script> が無いこと。
 *    ページが `export const config = { unstable_runtimeJS: false }` を忘れると、ここでビルドが落ちる。
 * 2. 文字列の途中に React の区切りコメント（<!-- -->）が無いこと。
 *    `ほか{n}項目` と書くと `ほか<!-- -->5<!-- -->項目` になり、検査の文字列照合がずれる。
 *    値を混ぜる文字列はテンプレートリテラルで1つにする。
 * 3. 誰からも参照されない out/_next/ を消す。
 *    Pages Router はクライアント用の束を作るが、上の宣言をしたページはそれを読まない。
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from '../paths';
const OUT = join(ROOT, 'out');
const pages = readdirSync(OUT).filter((f) => f.endsWith('.html')).sort();

const problems: string[] = [];
for (const f of pages) {
  const path = join(OUT, f);
  const h = readFileSync(path, 'utf8')
    .replaceAll(' data-next-head=""', '')
    .replaceAll('<noscript data-n-css=""></noscript>', '');
  writeFileSync(path, h);
  if (spaceHtml(h, false) !== h) problems.push(`${f}: 和文・英数字の半角スペースが未適用です`);
  const scripts = h.match(/<script\b(?![^>]*application\/ld\+json)[^>]*>/g) ?? [];
  if (scripts.length) problems.push(`${f}: 実行時の <script> が ${scripts.length} 件`);
  if (h.includes('/_next/')) problems.push(`${f}: /_next/ を参照している`);
  const seps = h.match(/<!-- -->/g) ?? [];
  if (seps.length) problems.push(`${f}: 区切りコメント <!-- --> が ${seps.length} 件`);
}

if (problems.length) {
  console.error('postbuild: 納品できない出力です\n  ' + problems.join('\n  '));
  process.exit(1);
}

rmSync(join(OUT, '_next'), { recursive: true, force: true });
console.log(`postbuild: ${pages.length}ページ・実行時の script 0件・区切りコメント 0件。out/_next を削除しました`);
