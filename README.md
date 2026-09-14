# 紬（つむぎ）サービスサイト

小規模事業者向けホームページ制作「紬」の自社サイト。21ページ。
**実行時 JavaScript 0バイト**が製品の主張そのものなので、そこを崩す変更はしない。

> **開発を引き継ぐとき（人・AI）は、まず [AGENTS.md](AGENTS.md) と [docs/status.md](docs/status.md) を読む。**

| | |
|---|---|
| 何のサイトか | 飲食店・工務店・美容室・士業向けのホームページ制作と運用。**顧客に納品するサイトのテンプレートも兼ねる** |
| 主張 | 「いまのホームページは借地権、紬がつくるのは所有権」 |
| 技術 | Next.js 16（Pages Router）+ React 19 + TypeScript → **静的 HTML** |
| 納品の条件 | 自動検査 **577 項目で FAIL 0** |
| 実行時 JS | **0 バイト**（全21ページ） |

**目次**：[1. リポジトリの地図](#1-リポジトリの地図) ／ [2. ソースから納品物まで](#2-ソースから納品物まで) ／ [3. 0バイトの守り方](#3-0バイトの守り方) ／ [4. サイトの構成](#4-サイトの構成) ／ [5. 動かす](#5-動かす) ／ [6. 変更の進め方](#6-変更の進め方) ／ [7. 顧客サイトを作るとき](#7-顧客サイトを作るとき) ／ [8. どの文書を読むか](#8-どの文書を読むか)

---

## 1. リポジトリの地図

```mermaid
flowchart LR
  root["tsumugi/"]
  root --> agents["AGENTS.md<br/>引き継ぎの入口"]
  root --> siteDir
  root --> docsDir

  subgraph siteDir["site/ サイト本体"]
    direction TB
    src["src/<br/>ページと部品"]
    styles["styles/<br/>CSS の正本"]
    public["public/<br/>フォントと画像"]
    scripts["scripts/<br/>ビルドの部品"]
    verify["verify/<br/>標準仕様の検査"]
    out[("out/<br/>納品物")]
  end

  subgraph docsDir["docs/ 理由と現状"]
    direction TB
    status["status.md<br/>現状と残課題"]
    business["business/<br/>事業の規範と数字"]
    product["product/<br/>主張とデザイン"]
    spec["spec.md<br/>検査している項目"]
    arch["architecture/<br/>判断の記録"]
    ops["operations.md<br/>公開と顧客サイト"]
    hist["history/<br/>移行の記録"]
  end
```

| 置き場所 | 何があるか | 詳しくは |
|---|---|---|
| `AGENTS.md` | 崩してはいけないこと・合格ライン・進め方・はまりどころ | [AGENTS.md](AGENTS.md) |
| `site/` | サイト本体。コードを触るときの決まり | [site/README.md](site/README.md) |
| `docs/` | 仕様・判断の理由・事業の文書・現状と残課題 | [docs/README.md](docs/README.md) |

---

## 2. ソースから納品物まで

人が編集するのは上段の**正本**（4つ）だけ。それより下はすべて生成物で、`out/` をそのまま置けば公開できる。

```mermaid
flowchart TD
  subgraph edit["人が編集する正本"]
    direction LR
    tokens["styles/<br/>design.tokens.json"]
    css["styles/*.css<br/>3つの層"]
    content["src/content/<br/>屋号・料金・図"]
    pages["src/views/<br/>21ページの本文"]
  end

  tokens -->|npm run tokens| tokcss["tokens.css"]
  tokcss --> theme["public/theme.css"]
  css --> theme
  content --> meta["robots.txt<br/>sitemap.xml"]
  content --> html["静的HTML<br/>21ページ"]
  pages -->|next build| html
  html -->|postbuild| out[("out/<br/>納品物 49ファイル")]
  theme --> out
  meta --> out
  og["public/og/<br/>OGP画像 24"] --> out
  out -->|npm run verify| report["verify-report.json<br/>PASS 577"]
```

- **金額の正本は `site/src/content/prices.ts` の1か所。** ページも検査も OGP 画像もここを読む。`docs/business/紬_事業の中身.xlsx` は写しで、Excel を直してもサイトは変わらない
- **CSS の正本は `site/styles/`。** `public/theme.css` は4枚を束ねた生成物
- ビルドの4段階と検査の中身は [site/README.md](site/README.md) に図がある

---

## 3. 0バイトの守り方

「実行時 JS 0バイト」は売り文句なので、**うっかり崩れても必ず止まる**ように3重にしてある。

```mermaid
flowchart TD
  page["ページ<br/>src/pages/*.tsx"] --> decl{"unstable_runtimeJS<br/>を false にしたか"}
  decl -->|した| quiet["script を出さない"]
  decl -->|忘れた| noisy["script を出す"]
  quiet --> post
  noisy --> post
  post["postbuild.ts<br/>① 印を消す<br/>② script を数える<br/>③ 区切りを数える<br/>④ _next/ を消す"]
  post -->|1件でもあれば| stop1["ビルドが止まる"]
  post -->|0件| check["verify<br/>実行時JSなし<br/>全21ページ"]
  check -->|FAIL| stop2["納品しない"]
  check -->|PASS| ok["納品できる"]
```

**App Router ではなく Pages Router を使っている理由**（Next.js 16.3.5・静的書き出しで測定）

| | HTML の `<script>` | 配られる JS（gzip） |
|---|---|---|
| App Router | 8 | **約173KB（全ページ・減らせない）** |
| **Pages Router ＋ `unstable_runtimeJS: false`** | **0** | **0 バイト** |

詳しくは [ADR 0001](docs/architecture/0001-pages-router.md)。なお、開発サーバーの HTML にはホットリロード用の JS が入る。**0バイトの対象は `out/`（納品物）。**

```mermaid
flowchart LR
  code["site/src/"] --> dev["npm run dev"]
  code --> build["npm run build"]
  dev --> devhtml["開発サーバー<br/>JS あり<br/>ホットリロード用"]
  build --> outhtml["out/<br/>JS 0バイト"]
  outhtml --> host["どこにでも置ける<br/>Vercel・Netlify<br/>Cloudflare・S3"]
```

---

## 4. サイトの構成

21ページ。ヘッダーの入口は4本だけで、**約束を書いた3枚は全ページのフッターから1タップ**で届く（検査「25 必須ページ」）。

```mermaid
flowchart LR
  index["index.html<br/>ホーム"]

  subgraph header["ヘッダーの入口"]
    owned["owned.html<br/>借地と所有"]
    price["price.html<br/>料金"]
    costcut["cost-cut.html<br/>掲載費の見直し"]
    subsidy["subsidy.html<br/>補助金"]
  end

  subgraph guide["ご案内（メニューとフッター）"]
    unlimited["unlimited.html<br/>変更は何回でも"]
    source["source.html<br/>ソースコード<br/>の納品"]
    spec["spec.html<br/>納品する仕様"]
    flow["flow.html<br/>制作の流れ"]
    works["works.html<br/>制作事例"]
    faq["faq.html<br/>よくあるご質問"]
    about["about.html<br/>私たちについて"]
    contact["contact.html<br/>相談する"]
  end

  subgraph industries["業種別（1テンプレートから4枚）"]
    restaurant["restaurant.html<br/>飲食店"]
    koumuten["koumuten.html<br/>工務店・建設"]
    salon["salon.html<br/>美容室・サロン"]
    shigyo["shigyo.html<br/>士業・専門事務所"]
  end

  subgraph promises["約束の置き場所（フッター下段）"]
    terms["terms.html<br/>ご契約とお約束"]
    privacy["privacy.html<br/>個人情報の<br/>取り扱い"]
    legal["legal.html<br/>特定商取引法に<br/>基づく表記"]
  end

  notfound["404.html"]

  index --> header
  index --> guide
  index --> industries
  header --> promises
  guide --> promises
  industries --> promises
```

---

## 5. 動かす

```bash
cd site
npm install
npx playwright install chromium   # 検査と OGP 画像の生成に使う（初回だけ）
npm run dev       # http://localhost:3000（使われていたら npm run dev -- -p 3001）
npm run check     # 型検査 ＋ 依存の向き
npm run build     # → out/
npm run verify    # PASS 577 / WARN 1 / FAIL 0 なら納品可
```

WARN 1 は `PLACEHOLDER=true`（電話番号・住所が仮）。公開前に潰す既知の1件（[公開前にやること](docs/operations.md)）。
ほかのコマンド（`tokens`・`og`・検査のオプション）は [site/README.md](site/README.md)。

---

## 6. 変更の進め方

```mermaid
flowchart TD
  branch["main から<br/>ブランチを切る"] --> change["変更する"]
  change --> check["npm run check"]
  check --> build["npm run build"]
  build --> verify["npm run verify<br/>PASS 577 / FAIL 0"]
  verify --> record["docs/status.md<br/>を更新<br/>判断は ADR に"]
  record --> commit["コミット<br/>作者は noreply"]
  commit --> mail["送るコミットの<br/>メールを確認"]
  mail --> pr["push して<br/>プルリクエスト"]
  pr --> main["main にマージ"]
  check -.->|落ちたら直す| change
  build -.->|落ちたら直す| change
  verify -.->|落ちたら直す| change
```

- GitHub のメール保護が有効なので、**個人のメールアドレスが入ったコミットは push できない**。確かめ方：`git log --format='%h %ae %ce %s' origin/main..HEAD`
- 見た目を変えないはずの変更では、`out/` の全ファイルが変更前と同じであることも確かめる
- 詳しくは [AGENTS.md](AGENTS.md)「5. 進め方」「6. はまりどころ」

---

## 7. 顧客サイトを作るとき

このサイトは1号案件で、**そのままテンプレートになる**。差し替える範囲は `src/content/`・`src/i18n/locales/ja/`・`src/routing/`・`src/views/` に分かれている。

```mermaid
flowchart TD
  copy["site/ をコピー"] --> s1

  subgraph swap["差し替える"]
    s1["src/content/<br/>屋号・料金・ナビ<br/>業種・仕様・図"]
    s2["src/views/<br/>ページの構造"]
    s3["src/i18n/locales/ja/<br/>本文・共有カードの文面"]
    s1 --> s2 --> s3
  end

  keep["そのまま使う<br/>components<br/>layouts・lib<br/>styles・verify<br/>scripts"]

  s3 --> og["npm run og"]
  og --> gate["npm run build<br/>npm run verify"]
  keep -.-> gate
  gate --> ship["顧客名義の<br/>Vercel と<br/>ドメインで公開"]
```

- `◯◯.vercel.app` のまま渡さない（「ドメインは初日からお客様の名義」という約束が守れない）
- 手順の詳細は [docs/operations.md](docs/operations.md)、層を分けた理由は [ADR 0004](docs/architecture/0004-content-and-routing.md)

---

## 8. どの文書を読むか

```mermaid
flowchart LR
  q1["いまの状態は？<br/>何が残っている？"] --> d1["docs/status.md"]
  q2["崩してはいけない<br/>ことは？"] --> d2["AGENTS.md"]
  q3["コマンドと<br/>決まりごとは？"] --> d3["site/README.md"]
  q4["なぜこの技術と<br/>構成なのか？"] --> d4["docs/architecture/"]
  q5["何を検査<br/>している？"] --> d5["docs/spec.md"]
  q6["サイトで何を<br/>主張している？"] --> d6["docs/product/"]
  q7["何を売り<br/>何を約束しない？"] --> d7["docs/business/"]
  q8["公開と顧客サイト<br/>の手順は？"] --> d8["docs/operations.md"]
```

| 文書 | 中身 |
|---|---|
| [docs/status.md](docs/status.md) | 現状と残課題（作業を終えたら更新する） |
| [AGENTS.md](AGENTS.md) | 崩してはいけないこと・合格ライン・進め方・はまりどころ |
| [site/README.md](site/README.md) | コマンド・ビルドと検査の流れ・書き方と置き場所の決まり |
| [docs/architecture/](docs/architecture/README.md) | 技術的な判断の一覧と ADR |
| [docs/spec.md](docs/spec.md) | 検査している項目と、検査で見つかった不具合 |
| [docs/product/](docs/README.md) | サイトの主張・値付け・デザイン |
| [docs/business/](docs/business/紬_ビジネスガイドライン.md) | 事業の規範と数字（正本） |
| [docs/operations.md](docs/operations.md) | 公開前にやること・顧客サイトの作り方・デプロイ |
| [docs/history/](docs/history/2026-09-migration.md) | Python／Astro から Next.js への移行の記録 |
