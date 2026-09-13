# 紬サイト ── Next.js + React + TypeScript

サービスサイト本体。21ページ、**実行時 JavaScript 0バイト**。
設計の理由（主張・値付け・検査項目・デザインの出所）は [DESIGN.md](DESIGN.md)。

```bash
npm install
npm run dev              # http://localhost:3000 （href="terms.html" のままのリンクも踏める）
npm run build            # トークン同期の検査 → public/ の生成 → next build → postbuild → out/
npm run verify           # 標準仕様の検査（ブラウザ実測を含む）。FAIL 0 で納品可
npm run verify -- --static   # 静的検査のみ（ブラウザ不要・CI向け。結果は verify-report.static.json）
npm run verify -- --write    # LCP実測値を src/data/config.ts に書き戻す
npm run tokens           # styles/design.tokens.json → styles/tokens.css（--check で同期検査）
npm run og               # OGP画像とファビコン（文面を変えたときだけ。差分をコミットする）
npm run check            # 型検査
```

---

## なぜ Pages Router なのか（App Router ではなく）

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

### `unstable_` を使っている危うさと、その囲い方

`unstable_runtimeJS` は名前のとおり将来の版で変わりうる。そこで、**黙って崩れない**ようにしてある。

1. `scripts/postbuild.ts` が、JSON-LD 以外の `<script>` が1つでもあれば **ビルドを落とす**
2. `verify` の「実行時JSなし」が全ページで FAIL にする

Next.js を上げるときは `npm run build && npm run verify` が通ることを確かめてから。
通らなければ上げない。

> 開発サーバー（`npm run dev`）の HTML には、ホットリロード用の script が入る。
> **0バイトの対象は `out/`（納品物）。** 開発中の見た目で判断しないこと。

---

## 書き方の決まり

| 決まり | 理由 |
|---|---|
| **全ページに `export const config = { unstable_runtimeJS: false }`** | 忘れると postbuild で落ちる |
| **値を混ぜる文字列はテンプレートリテラルで1つにする**（`` {`ほか${n}項目`} ``） | `ほか{n}項目` と書くと React が `ほか<!-- -->5<!-- -->項目` を出し、検査の文字列照合がずれる。postbuild で落ちる |
| HTML 文字列（`<strong>` 入りの本文）は `dangerouslySetInnerHTML={raw(…)}` | 本文は Python 版から HTML 文字列のまま移した。自前のデータだけを渡す |
| 図は `<Figure svg={D.landVsOwn()} />` | `lib/diagrams.ts` は `<figure>` ごと文字列で返す。外側だけ要素にして中身を流し込む |
| `node:fs` は `getStaticProps` の中だけ | ページ本体から使うとクライアント用の束の作成で落ちる |
| `next/link` と `next/image` は使わない | どちらも実行時JSか画像サーバーを前提にしている。静的HTMLには不要 |
| ページ名はフラットな `.html`、内部リンクも `href="terms.html"` | どのホスティングでも確実に動く。クリーンURLはホスト側の設定でやる |

---

## 構成

| | |
|---|---|
| `src/pages/*.tsx` | 1ファイル＝1ページ。業種4枚は `[industry].tsx` から出る |
| `src/pages/_document.tsx` | ページに依らない head（テーマ色・アイコン・CSS）と `<html lang="ja">` |
| `src/layouts/Base.tsx` | **器の本体。**ページごとの head / OGP / JSON-LD / ヘッダー / フッター / 固定CTA |
| `src/components/*.tsx` | Section / Table / Note / Calc / Flow / Stats / Acc / Cta / Entry / Plans / Cards / Vs / Figure / Icon |
| `src/data/config.ts` | **屋号・連絡先・テーマ。別ブランドに振り替えるときはここを編集する** |
| `src/data/prices.ts` | **価格の単一の出所。**`as const` で値から型が付く。添字ではなく `build(key)` / `run(key)` で引く |
| `src/data/icons.ts` | Lucide（lucide-static v0.454.0, ISC）のパス。**使うアイコンはここに足す** |
| `src/data/nav.ts` / `industries.ts` / `spec.ts` | ナビ・業種・仕様の並び |
| `src/lib/diagrams.ts` | **図。手書きのインラインSVG** |
| `styles/` | **CSS とデザイントークンの正本。**`public/theme.css` は `scripts/build-public.ts` が束ねた生成物 |
| `public/fonts/` `public/og/` | League Gothic（OFL）と、`npm run og` の生成物（コミットする） |
| `scripts/` | `build-public.ts`（theme.css / robots.txt / sitemap.xml）・`postbuild.ts`（0バイトの番人）・`build-tokens.ts`・`og.ts` |
| `verify/` | **標準仕様の自動検査。これが仕様の実体** |

---

## Vercel に載せるとき

- 静的出力（`out/`）なので **Hobby でも足りる。** Framework Preset は Next.js のままでよい
- **公開URLは独自ドメインにする。** `◯◯.vercel.app` のまま渡すと、
  全プランに書いた「独自ドメイン取得（初日からお客様の名義）」が守れない。
  vercel.app は公開前の確認用に使う
- 顧客ごとに顧客名義の Vercel アカウントへ。**土地も顧客のもの**にしておく
- `out/` はそのまま Cloudflare Pages / Netlify / S3 にも置ける（③地盤の主張どおり）
