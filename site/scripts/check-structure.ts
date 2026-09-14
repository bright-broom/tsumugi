/**
 * ディレクトリの依存の向きを検査する（npm run check で走る）。
 *
 *   pages → layouts → components → content → lib
 *
 * 右にあるものは左を import しない。
 * - lib      … 何にも依存しない小道具。どの案件でもそのまま使う
 * - content  … このサイトに固有の中身。別案件では同じ形の export を保って差し替える
 * - scripts / verify は content と lib だけを使う（部品やページには触らない）
 *
 * src の中は @/ で import する。相対パスだと、置き場所を変えるたびに import を書き換えることになる。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const LAYERS = ['pages', 'layouts', 'components', 'content', 'lib'] as const;
type Layer = (typeof LAYERS)[number];

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) ? [p] : [];
  });

const problems: string[] = [];
for (const dir of ['src', 'scripts', 'verify']) {
  for (const f of files(join(ROOT, dir))) {
    const rel = relative(ROOT, f).split(sep).join('/');
    const from = rel.startsWith('src/') ? (rel.split('/')[1] as Layer) : 'tools';
    for (const [, spec] of readFileSync(f, 'utf8').matchAll(/from '([^']+)'/g)) {
      if (from !== 'tools' && spec!.startsWith('.')) {
        problems.push(`${rel}: 相対パスで import している（@/ を使う）: ${spec}`);
        continue;
      }
      if (!spec!.startsWith('@/')) continue;
      const to = spec!.slice(2).split('/')[0] as Layer;
      const ok = from === 'tools'
        ? to === 'content' || to === 'lib'
        : LAYERS.includes(to) && LAYERS.indexOf(to) >= LAYERS.indexOf(from);
      if (!ok) problems.push(`${rel}: ${from} から ${to} を import している: ${spec}`);
    }
  }
}

if (problems.length) {
  console.error('check-structure: 依存の向きが崩れています\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('check-structure: pages → layouts → components → content → lib の向きを保っています');
