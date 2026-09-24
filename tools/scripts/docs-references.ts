/**
 * 文書が指しているもの（リンク・npm script・ファイルの道筋）の照合（監査 B05）。
 *
 * この引き継ぎは「会話の履歴がなくても、文書とコードで続けられる」ことを前提にしている。
 * 文書が存在しないファイルやコマンドを指していると、その前提が静かに壊れる。
 * ここはファイルを読まない純粋な判定にし、読み込みは check-docs.ts が行う。
 */

export interface DocFile {
  /** リポジトリからの相対パス（区切りは /）。 */
  path: string;
  text: string;
}

export type Entry = 'file' | 'directory' | 'missing';

export interface Context {
  scripts: readonly string[];
  /** リポジトリからの相対パスが何であるかを返す。 */
  entry: (path: string) => Entry;
  /** ビルドが作るファイル（checkout 直後には無い）。文書は指してよい。 */
  generated?: readonly string[];
}

/** リポジトリの中身を指す道筋の起点。 */
const ROOTS = ['src', 'tools', 'tests', 'services', 'config', 'docs', 'public', '.github'];

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const NPM_RUN = /npm run ([a-z][a-z0-9:-]*)/g;
const QUOTED = /`([^`\n]+)`/g;
const ALLOW = /<!--\s*check-docs:\s*allow\s+(\S+)/g;
/** `npm run ops:*`・`npm run verify<br/>` のように、名前が途中で終わる書き方は見ない。 */
const TRUNCATED = new Set(['*', '<', ':', '-']);

/** `a/b/../c` を畳む。`..` がリポジトリの外へ出たら null。 */
function normalize(path: string): string | null {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part !== '..') parts.push(part);
    else if (parts.length) parts.pop();
    else return null;
  }
  return parts.join('/');
}

/** ワイルドカード・省略記号・変数を含む道筋は、特定のファイルを指していない。 */
const pathLike = (text: string): boolean =>
  ROOTS.some((root) => text === root || text.startsWith(`${root}/`)) &&
  /\.[a-z0-9]+$/i.test(text) &&
  !/[*<>|$\s…{}()]/.test(text);

export function documentProblems(files: readonly DocFile[], context: Context): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    const allowed = new Set([...file.text.matchAll(ALLOW)].map(([, path]) => path!));
    const at = (line: number, message: string) => problems.push(`${file.path}:${line}: ${message}`);

    file.text.split('\n').forEach((line, index) => {
      const number = index + 1;

      for (const [, target] of line.matchAll(LINK)) {
        if (!target || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
        const [path] = target.split('#');
        if (!path) continue;
        const resolved = normalize(`${dir}/${decodeURIComponent(path)}`);
        if (resolved === null) at(number, `リポジトリの外を指しています: ${target}`);
        else if (!context.generated?.includes(resolved) && context.entry(resolved) === 'missing')
          at(number, `リンク先がありません: ${target}`);
      }

      for (const match of line.matchAll(NPM_RUN)) {
        const name = match[1];
        if (!name || TRUNCATED.has(line[match.index + match[0].length] ?? '')) continue;
        if (!context.scripts.includes(name))
          at(number, `package.json にない npm script です: npm run ${name}`);
      }

      for (const [, quoted] of line.matchAll(QUOTED)) {
        const text = (quoted ?? '').replace(/^\.\//, '').split(':')[0] ?? '';
        if (!pathLike(text) || allowed.has(text) || context.generated?.includes(text)) continue;
        if (context.entry(text) !== 'file') at(number, `ファイルがありません: ${text}`);
      }
    });
  }
  return problems;
}
