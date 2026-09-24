import { describe, expect, it } from 'vitest';
import { documentProblems, type Context, type DocFile } from '../tools/scripts/docs-references';

const context = (over: Partial<Context> = {}): Context => ({
  scripts: ['build', 'verify', 'ops:crm'],
  entry: (path) =>
    path === 'docs/status.md' || path === 'src/content/prices.ts'
      ? 'file'
      : path === 'src/content'
        ? 'directory'
        : 'missing',
  ...over,
});
const doc = (path: string, text: string): DocFile[] => [{ path, text }];
const check = (path: string, text: string, over?: Partial<Context>) =>
  documentProblems(doc(path, text), context(over));

describe('文書の参照', () => {
  it('実在するリンク・コマンド・ファイルは通す', () => {
    expect(
      check(
        'docs/README.md',
        [
          '[現状](status.md) と [料金の正本](../src/content/prices.ts)。',
          '`npm run build` のあとに `npm run verify` を実行する。',
          '文言は `src/content/prices.ts` から引く。',
          '外部は [GitHub](https://github.com/example) と [問い合わせ](mailto:a@example.com)、',
          '同じ文書の中は [見出し](#決まり)。',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('リンク先・コマンド・ファイルの欠落を、行の番号つきで出す', () => {
    expect(check('docs/README.md', '[古い手順](operations/old.md)')).toEqual([
      'docs/README.md:1: リンク先がありません: operations/old.md',
    ]);
    expect(check('docs/product/guide.md', '`npm run deploy` で配る')).toEqual([
      'docs/product/guide.md:1: package.json にない npm script です: npm run deploy',
    ]);
    expect(check('docs/product/guide.md', '図は `src/content/diagrams.ts` にある')).toEqual([
      'docs/product/guide.md:1: ファイルがありません: src/content/diagrams.ts',
    ]);
    // フォルダはファイルの道筋として書かれていれば不一致（`src/content/` のような書き方は対象外）。
    expect(check('docs/README.md', '[中身](../src/content)')).toEqual([]);
  });

  it('相対パスは文書の場所から解決し、リポジトリの外は拒否する', () => {
    expect(check('docs/product/guide.md', '[現状](../status.md)')).toEqual([]);
    expect(check('docs/product/guide.md', '[外](../../../secrets.md)')).toEqual([
      'docs/product/guide.md:1: リポジトリの外を指しています: ../../../secrets.md',
    ]);
    expect(check('docs/product/guide.md', '[現状](../status.md#残課題)')).toEqual([]);
  });

  it('名前が途中で終わる書き方と、理由を書いた除外は見ない', () => {
    expect(check('docs/development.md', '`npm run ops:*` で社内ツールを動かす')).toEqual([]);
    expect(check('docs/product/overview.md', 'build --> v["npm run verify<br/>PASS"]')).toEqual([]);
    expect(
      check(
        'docs/architecture/0022.md',
        [
          '<!-- check-docs: allow src/content/diagrams.ts （当時の経路） -->',
          '`src/content/diagrams.ts` が図を作っていた',
        ].join('\n'),
      ),
    ).toEqual([]);
    // 除外は、その文書の中だけで効く。
    expect(check('docs/product/design.md', '`src/content/diagrams.ts` にある')).toHaveLength(1);
  });

  it('ワイルドカード・変数・空白を含む道筋は、特定のファイルを指していないので見ない', () => {
    const text = [
      '`src/pages/**/*.tsx` と `tools/ops/<ツール名>/cli.ts` と `docs/architecture/0082-*.md`',
      '`src/content/prices.ts:12` のような行つきの参照は、ファイルだけを見る',
    ].join('\n');
    expect(check('docs/development.md', text)).toEqual([]);
  });

  it('複数の文書をまとめて見る', () => {
    expect(
      documentProblems(
        [
          { path: 'README.md', text: '[状態](docs/status.md)' },
          { path: 'docs/a.md', text: '[無い](b.md)\n`npm run nope`' },
        ],
        context(),
      ),
    ).toEqual([
      'docs/a.md:1: リンク先がありません: b.md',
      'docs/a.md:2: package.json にない npm script です: npm run nope',
    ]);
  });
});
