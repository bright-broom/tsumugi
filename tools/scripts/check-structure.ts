/**
 * ディレクトリの依存の向きを検査する（npm run check で走る）。
 *
 *   pages → application → views → layouts → components → content → i18n → routing → lib
 *
 * 右にあるものは左を import しない。
 * - lib      … 何にも依存しない小道具。どの案件でもそのまま使う
 * - content  … このサイトに固有の中身。別案件では同じ形の export を保って差し替える
 * - scripts / verify は content と lib だけを使う（部品やページには触らない）
 * - services（配備先で動く受付などのサーバー処理）も content・i18n・routing・lib だけを使い、
 *   services の外へ相対パスで出ない。src と tools は services を import しない（ADR 0032）
 *
 * src の中は @/ で import する。相対パスだと、置き場所を変えるたびに import を書き換えることになる。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
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
type Source = Layer | 'tools' | 'services';
const OUTSIDE_SRC: readonly string[] = ['content', 'i18n', 'routing', 'lib'];

const files = (dir: string, extension = /\.tsx?$/): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p, extension) : extension.test(name) ? [p] : [];
  });

const problems: string[] = [];
// allowJs:false excludes JavaScript from type checking; it does not prevent new JS files.
const javascript = /\.(?:[cm]?js|jsx)$/;
const untypedSources = [
  ...readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && javascript.test(entry.name))
    .map((entry) => join(ROOT, entry.name)),
  ...['src', 'tools', 'services', 'config', 'tests'].flatMap((dir) =>
    files(join(ROOT, dir), javascript),
  ),
];
for (const file of untypedSources) {
  problems.push(
    `${relative(ROOT, file)}: 手書きソースは TypeScript (.ts / .tsx) に統一してください`,
  );
}
const graph = new Map<string, string[]>();
for (const dir of ['src', 'tools', 'services']) {
  for (const f of files(join(ROOT, dir))) {
    const rel = relative(ROOT, f).split(sep).join('/');
    const from: Source = rel.startsWith('src/')
      ? (rel.split('/')[1] as Layer)
      : rel.startsWith('services/')
        ? 'services'
        : 'tools';
    if (from !== 'tools' && from !== 'services' && !LAYERS.includes(from))
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
      if (spec.startsWith('.')) {
        const resolved = relative(ROOT, join(dirname(f), spec)).split(sep).join('/');
        if (from === 'services' && !resolved.startsWith('services/'))
          problems.push(`${rel}: services の外を相対パスで import している: ${spec}`);
        if (from === 'tools' && resolved.startsWith('services/'))
          problems.push(`${rel}: tools から services を import している: ${spec}`);
      }
      if (from !== 'tools' && from !== 'services' && spec!.startsWith('.')) {
        problems.push(`${rel}: 相対パスで import している（@/ を使う）: ${spec}`);
        continue;
      }
      if (!spec!.startsWith('@/')) continue;
      // The shared design-token JSON is a data-only leaf, also used by document metadata and OGP.
      if (spec === '@/styles/design.tokens.json') {
        if (!statSync(join(ROOT, 'src/styles/design.tokens.json')).isFile())
          problems.push(`${rel}: デザイントークンの正本がありません`);
        continue;
      }
      // The CMS snapshot is a data-only leaf written by tools/cms/pull.ts (ADR 0080).
      if (spec === '@/i18n/locales/ja/entries/cms.json') {
        if (
          from !== 'i18n' ||
          !statSync(join(ROOT, 'src/i18n/locales/ja/entries/cms.json')).isFile()
        )
          problems.push(`${rel}: CMS のスナップショットは i18n の entries からだけ読み込む`);
        continue;
      }
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
        from === 'tools' || from === 'services'
          ? OUTSIDE_SRC.includes(to)
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
  console.error(
    'check-structure: ソースの配置・形式・依存を確認してください\n  ' + problems.join('\n  '),
  );
  process.exit(1);
}
console.log(`check-structure: ${LAYERS.join(' → ')} の向きを保っています`);
