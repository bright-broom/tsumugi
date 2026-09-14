# 0001 Next.js は Pages Router で書き、静的HTMLに書き出す

- 状態：採用（2026-09）
- 関連：[移行の記録](../history/2026-09-migration.md)

## 背景

サイトの主張の1つが「実行時 JavaScript 0バイト」。部品と型は React・TypeScript で持ちたいが、
納品物（`site/out/`）に JavaScript を載せることはできない。

## 決定

Next.js 16 の **Pages Router** で書き、全ページに `export const config = { unstable_runtimeJS: false }` を置いて、
`output: 'export'` で静的HTMLに書き出す。App Router は使わない。

## 決定の根拠：同じ条件で測った

同じ Next.js 16.3.5・`output: 'export'` で、最小構成を作って測った。

| | HTML の `<script>` | 配られる JS（gzip） |
|---|---|---|
| App Router | 8 | **約173KB（全ページ・減らせない）** |
| **Pages Router ＋ `unstable_runtimeJS: false`** | **0** | **0 バイト** |

サイトの主張がここに乗っている。

- `spec.html`「実行時のプログラム ありません（0バイト）」
- `owned.html` 所有の4要素 ③地盤「実行時JSが0バイトなので、どのサーバーにも置けます」
- `verify` の「実行時JSなし」が全ページで通ること

**App Router にするとこの3つが同時に崩れる。** 速度の話ではなく、売り文句の根拠の話。

## 引き受けたリスク：`unstable_` を使っていること

`unstable_runtimeJS` は名前のとおり将来の版で変わりうる。そこで、**黙って崩れない**ようにしてある。

1. `scripts/postbuild.ts` が、JSON-LD 以外の `<script>` が1つでもあれば **ビルドを落とす**
2. `verify` の「実行時JSなし」が全ページで FAIL にする

Next.js を上げるときは `npm run build && npm run verify` が通ることを確かめてから。
通らなければ上げない。

> 開発サーバー（`npm run dev`）の HTML には、ホットリロード用の script が入る。
> **0バイトの対象は `out/`（納品物）。** 開発中の見た目で判断しないこと。
