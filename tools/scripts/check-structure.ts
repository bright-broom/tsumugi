/**
 * ディレクトリの依存の向きを検査する（npm run check で走る）。
 *
 *   pages → application → views → layouts → components → content → i18n → routing → lib
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
import ts from 'typescript';

import { ROOT } from '../paths';
const LAYERS = [
  'pages',
  'application',
  'views',
  'layouts',
  'components',
  'content',
  'i18n',
  'routing',
  'lib',
] as const;
type Layer = (typeof LAYERS)[number];

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) ? [p] : [];
  });

const problems: string[] = [];
const graph = new Map<string, string[]>();
for (const dir of ['src', 'tools']) {
  for (const f of files(join(ROOT, dir))) {
    const rel = relative(ROOT, f).split(sep).join('/');
    const from = rel.startsWith('src/') ? (rel.split('/')[1] as Layer) : 'tools';
    if (from !== 'tools' && !LAYERS.includes(from))
      problems.push(`${rel}: 未定義のソース層です。配置と依存の向きを明示してください`);
    const source = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
    const imports: string[] = [];
    function collect(node: ts.Node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        imports.push(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        imports.push(node.arguments[0].text);
      ts.forEachChild(node, collect);
    }
    collect(source);
    graph.set(rel, []);
    for (const spec of imports) {
      if (from !== 'tools' && spec!.startsWith('.')) {
        problems.push(`${rel}: 相対パスで import している（@/ を使う）: ${spec}`);
        continue;
      }
      if (!spec!.startsWith('@/')) continue;
      const to = spec!.slice(2).split('/')[0] as Layer;
      const target = ['.ts', '.tsx', '/index.ts', '/index.tsx']
        .map((ext) => `src/${spec.slice(2)}${ext}`)
        .find((candidate) => {
          try {
            return statSync(join(ROOT, candidate)).isFile();
          } catch {
            return false;
          }
        });
      if (!target) problems.push(`${rel}: import 先がありません: ${spec}`);
      else graph.get(rel)!.push(target);
      const ok =
        from === 'tools'
          ? ['content', 'i18n', 'routing', 'lib'].includes(to)
          : LAYERS.includes(to) && LAYERS.indexOf(to) >= LAYERS.indexOf(from);
      if (!ok) problems.push(`${rel}: ${from} から ${to} を import している: ${spec}`);
    }
  }
}

// Same-layer imports are allowed, but cycles are not (including re-exports and dynamic imports).
const done = new Set<string>();
const active = new Set<string>();
function visit(file: string, trail: string[]) {
  if (active.has(file)) {
    problems.push(`循環依存: ${[...trail, file].join(' → ')}`);
    return;
  }
  if (done.has(file)) return;
  active.add(file);
  for (const target of graph.get(file) ?? []) visit(target, [...trail, file]);
  active.delete(file);
  done.add(file);
}
for (const file of graph.keys()) visit(file, []);

if (problems.length) {
  console.error('check-structure: 依存の向きが崩れています\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-structure: ${LAYERS.join(' → ')} の向きを保っています`);
