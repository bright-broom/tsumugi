# 紬（つむぎ）

**事業の土台づくりと日々の改善を支えるサービスサイト。**

Next.js・React・TypeScriptで構築し、21ページを静的HTMLとして配信します。文言・料金・URL・見た目を中央管理し、公開ページの**実行時JavaScriptは0バイト**に保っています。同じコードを、顧客サイトのテンプレートとして展開する前提の構成です。

[開発を始める](#開発を始める) · [構成を見る](#ディレクトリ構成) · [編集する場所](#変更したいときの入口) · [現在の状態](docs/status.md) · [資料一覧](docs/README.md)

## 全体像

Reactはビルド時にHTMLを作ります。閲覧者にはHTML・CSS・画像を届け、リンクやメニューはブラウザ標準の機能で動かします。

```mermaid
flowchart TD
  subgraph source["編集するもの"]
    data["文言・料金・URL"]
    ui["Reactの表示部品"]
    styling["Tailwind・画像"]
  end
  subgraph build["ビルド環境"]
    next["Next.js Pages Router"]
    guard["postbuild<br/>実行時JSの混入検査"]
  end
  data --> next
  ui --> next
  styling --> next
  next --> guard
  guard --> out["out/<br/>静的な納品物"]
  out --> host["Vercel"]
  host --> reader["閲覧者<br/>HTML・CSS・画像"]
```

| 役割             | 採用しているもの                           |
| ---------------- | ------------------------------------------ |
| ページ生成       | Next.js 16 / Pages Router・React 19        |
| 型とデータ検証   | TypeScript・Zod                            |
| 見た目とアイコン | Tailwind CSS 4・LucideのSVG                |
| 品質確認         | ESLint・Knip・Vitest・Playwright・独自検査 |
| 開発・公開       | Node.js 24・npm 12・GitHub Actions・Vercel |

正確な依存バージョンは [package.json](package.json) と [package-lock.json](package-lock.json) が正本です。TypeScriptのCLIと検査ツール用APIを併用する理由は [ADR 0003](docs/architecture/0003-modern-stack.md) にまとめています。

## ブランドの配色

| メイン70% | サブ20% | アクセント10% |
|---|---|---|
| アイボリー `#FFF8ED` | エスプレッソ `#302820` | 琥珀 `#FFB000` |
| 背景・余白 | 文字・説明の章 | 主要ボタン・料金・相談 |

比率はイラストを除くUI面積の目安です。3色の正本と派生トークンを中央管理し、ヘッダーからフッター、共有カードまで揃えています。[配色ルール](docs/product/design.md#3色の使い方と721) · [判断と検証](docs/architecture/0016-warm-base-palette.md)

## ディレクトリ構成

単一アプリをリポジトリのルートから操作します。`src/` に実装、`tools/` に開発と検査、`docs/` に仕様と判断を置きます。

```text
.
├── src/                        アプリケーション
│   ├── pages/                  URLの入口・静的生成
│   ├── application/            ページデータと表示の組み立て
│   ├── views/                  ページごとの表示
│   ├── layouts/                共通レイアウト
│   ├── components/             ヘッダー・フッター・図解等の部品
│   ├── content/                料金・事業設定・図解データ
│   ├── i18n/                   表示テキストの中央管理
│   ├── routing/                URLとページ分類の中央管理
│   ├── lib/                    共通の小さな処理
│   ├── styles/                 Tailwind・デザイントークン
│   └── assets/                 ヒーロー等の元画像
├── public/                     配信素材と生成済みCSS・画像
├── tests/                      アプリと開発基盤のテスト
├── tools/
│   ├── scripts/                起動・生成・構造検査
│   ├── verify/                 納品物の検査・ブラウザ実測
│   ├── pricing/                事業の料金・工数モデル
│   └── paths.ts                ルートと生成物の共通パス
├── config/                     ESLint・Knip・Vitest・Prettierの設定
├── docs/                       開発・仕様・設計判断・事業資料
├── .github/                    CI・Dependabot
├── .artifacts/                 レポート・検査画像（Git管理外）
├── out/                        静的な納品物（Git管理外）
└── .next/                      Next.jsの生成物（Git管理外）
```

`package.json`・`next.config.ts`・`tsconfig.json`・`vercel.json` はツールが設定を見つける起点としてルートに残しています。配置の理由は [ADR 0012](docs/architecture/0012-root-project-layout.md) を参照してください。

### コードの依存方向

矢印は**参照できる方向**です。途中の層を飛ばして下流を参照できますが、逆向きの参照と循環は禁止しています。`@/` は `src/` を指します。

```mermaid
flowchart TD
  pages["pages / URLの入口"] --> app["application / 組み立て"]
  app --> views["views / ページ表示"]
  views --> layouts["layouts / 共通の枠"]
  layouts --> components["components / 共通部品"]
  components --> content["content / 事業データ"]
  content --> i18n["i18n / 文言"]
  i18n --> routing["routing / URL"]
  routing --> lib["lib / 共通処理"]
```

この境界は `npm run check` が検査します。未使用コードの再混入も同じコマンドで検出します（[ADR 0013](docs/architecture/0013-dead-code-cleanup.md)）。`styles/` と `assets/` は表示資源として分けており、上のコード層には含めません。

## 変更したいときの入口

ページに同じ値を繰り返し書かず、まず正本を変更します。

| 変更したいもの                     | 編集する場所                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| 見出し・本文・SEO・図のラベル      | [src/i18n/locales/ja/](src/i18n/locales/ja/)                                         |
| 金額・プラン・価格計算             | [src/content/prices.ts](src/content/prices.ts)                                       |
| 連絡先・ドメイン・フォーム送信先   | [src/content/config.ts](src/content/config.ts)                                       |
| ページのURL・アイコン・ナビ分類    | [src/routing/registry.ts](src/routing/registry.ts)                                   |
| ページの構造・共通部品             | [src/views/](src/views/)・[src/components/](src/components/)                         |
| 色・書体・寸法                     | [src/styles/design.tokens.json](src/styles/design.tokens.json)                       |
| レイアウト・装飾・レスポンシブ表示 | [src/styles/](src/styles/)                                                           |
| SVG図解の形・座標                  | [src/content/diagrams.ts](src/content/diagrams.ts)                                   |
| ヒーローの元画像                   | [src/assets/hero/](src/assets/hero/)                                                 |
| 事業の工数・収支の仮定             | [tools/pricing/](tools/pricing/)・[料金設計](docs/business/pricing-redesign-140h.md) |

事業資料のExcelは価格の写しです。Excelを直してもサイトの料金は変わりません。`out/`、`public/theme.css`、`src/styles/tokens.css` は生成結果なので手で編集しません。

## ページができるまで

URLの登録と文言をもとに、ビルド時にページ用の変数を用意します。個別の文言はprops、共通部品の文言はContentProviderを通して渡します。

```mermaid
flowchart TD
  registry["routing/registry.ts<br/>URL・テンプレートの登録"] --> entry["pages/<br/>getStaticPaths・getStaticProps"]
  registry --> navigation["ナビ・サイトマップ"]
  entry --> props["application/static-props.ts<br/>ページの変数を用意"]
  catalog["i18n/locales/ja/<br/>日本語カタログ"] --> props
  props --> select["application/Page.tsx<br/>テンプレートを選択"]
  select --> view["views/<br/>個別文言をpropsで受け取る"]
  select --> provider["ContentProvider<br/>共通文言を配布"]
  provider --> common["共通レイアウト・部品"]
  business["content/<br/>料金・事業データ"] --> view
  business --> common
  view --> html["静的HTML"]
  common --> html
```

現在の対応言語は**日本語のみ**です。i18nは文言を中央管理する基盤であり、言語切り替え機能は未実装です。ヒーロー画像に描き込まれた文字も、カタログからの生成へ移す課題が残っています。

### ページの地図

21ページは、サービス案内13・法務3・業種別4・404ページ1で構成します。以下は分類の図で、すべてのリンク関係を表すものではありません。

```mermaid
flowchart LR
  routes["ルート登録 / 21ページ"] --> main["サービス案内 / 13"]
  routes --> industry["業種別 / 4"]
  routes --> legal["法務 / 3"]
  routes --> error["エラー / 1"]
  main --> offer["index・owned・price<br/>unlimited・source"]
  main --> proof["cost-cut・subsidy・spec<br/>flow・works"]
  main --> consult["faq・about・contact"]
  industry --> sectors["restaurant・koumuten<br/>salon・shigyo"]
  legal --> rules["terms・privacy・legal"]
  error --> missing["404"]
```

公開URLは `/price.html` のような形式です。業種別4ページは共通テンプレートを使います。新しいページの追加手順は [開発ガイド](docs/development.md#ページを追加するとき) を参照してください。

## 見た目の中央管理

色・書体・寸法をデザイントークンにまとめ、ページと共有カード画像で使います。公開ページのCSS入口は `globals.css` です。

```mermaid
flowchart TD
  tokens["design.tokens.json<br/>色・書体・寸法の正本"] -->|npm run tokens| theme["tokens.css<br/>Tailwindのテーマ"]
  theme --> global["globals.css<br/>公開ページのCSS入口"]
  parts["base・components・responsive<br/>home・footer・pages"] --> global
  global -->|Tailwind CLI| css["public/theme.css<br/>全ページで共有"]
  theme --> og["og.css<br/>共有カード用"]
  og -->|画像生成時に使用| image["OGP画像"]
```

トークンを変更したら `npm run tokens`、CSSのコンパイルだけなら `npm run styles` を使います。`npm run dev` はテーマ生成とCSS監視も起動します。OGP画像の再生成には書体環境の条件があるため、実行前に [残課題](docs/status.md#c-開発の基盤) を確認してください。

## 開発を始める

すべてリポジトリルートで実行します。Node.jsは [.nvmrc](.nvmrc) に合わせます。

```sh
nvm install && nvm use
npm install --global npm@12.0.2
npm ci
npm run dev
```

通常の確認先は `http://localhost:3000`。3001番で起動する場合は次を使います。

```sh
npm run dev -- --port 3001 --hostname 127.0.0.1
```

開発サーバーには更新通知用のJavaScriptが含まれます。**0バイトを確認する対象は、ビルド後の `out/` です。**

## ビルドと品質確認

`npm run build` は4段階で公開ファイルを作り、検査に失敗すると停止します。

```mermaid
flowchart TD
  sync["1. トークンの同期検査"] --> assets["2. publicの生成<br/>CSS・ヒーローSVG・サイトマップ等"]
  assets --> next["3. next build<br/>21ページを静的書き出し"]
  next --> post["4. postbuild<br/>不要な印の除去・実行時JSの検査"]
  post --> out["out/<br/>納品物"]
  out --> static["静的検査<br/>文言・価格・リンク・構造等"]
  out --> browser["ブラウザ検査<br/>表示幅・操作領域・コントラスト等"]
  static --> reports[".artifacts/verification/<br/>検査レポート"]
  browser --> reports
  browser --> shots[".artifacts/screenshots/<br/>確認画像"]
```

| コマンド               | 確認するもの                                             |
| ---------------------- | -------------------------------------------------------- |
| `npm run check`        | 型・依存方向・文言とURL・CSSの中央管理・未使用コード     |
| `npm run check:unused` | 未使用のファイル・export・型・依存関係（`check` に含む） |
| `npm run lint`         | コードの規約                                             |
| `npm test`             | アプリと開発基盤の単体テスト                             |
| `npm run test:pricing` | 事業の料金・工数モデル                                   |
| `npm run validate`     | check・lint・両単体テスト → ビルド → 静的検査            |
| `npm run verify`       | 生成済みの `out/` をブラウザ実測も含めて検査             |

変更を出す前は次の順で確認します。`verify` 自体はビルドを行いません。

```sh
npm run validate
PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium  # 初回・Playwright更新時
npm run verify
```

検査の条件は [仕様](docs/spec.md)、直近の検証結果と既知の警告は [現在の状態](docs/status.md) に集約しています。FAILがある場合は納品しません。JSON-LDは構造化データとして許容し、それ以外の実行時スクリプトの混入を検査します。

## GitHubから公開まで

ブランチを作ってPRを出し、CIとプレビューを確認してから `main` にマージします。図の各工程はリリースの流れであり、GitHubのブランチ保護による強制を示すものではありません。

```mermaid
flowchart TD
  branch["作業ブランチ"] --> pr["GitHubへpush・PR作成"]
  pr --> ci["GitHub Actions<br/>validate・ブラウザ検査"]
  pr --> preview["Vercelプレビュー<br/>validate・静的配信"]
  ci --> review["結果と画面を確認・レビュー"]
  preview --> review
  review --> merge["mainへマージ"]
  merge --> deploy["Vercelの本番デプロイ"]
  deploy --> launch["正式公開<br/>事業者情報・フォーム・独自ドメイン等を確認"]
```

VercelはRoot Directoryを未指定（リポジトリルート）とし、`npm run validate` で作った `out/` を配信します。手動プレビューは `npm run deploy:preview`。配備設定は [vercel.json](vercel.json)、公開手順は [運用ガイド](docs/operations.md) を参照してください。

**現在は正式公開に向けた準備中です。** 事業者情報・ドメインには仮の値があり、問い合わせフォームの送信先は未設定です。検査の合格やデプロイの成功は、これらの設定完了を意味しません。機能ごとの未実装・設定待ち・運用未確認は [監査一覧 #41](https://github.com/bright-broom/tsumugi/issues/41) で追跡しています。

全21ページの役割、共通化する情報と各ページに残す条件は [情報設計](docs/product/information-architecture.md) にまとめています。

## 目的別のドキュメント

| 知りたいこと                           | 読む文書                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| 開発を引き継ぐ・守る決まりを確認する   | [AGENTS.md](AGENTS.md)                                       |
| 今の状態・残課題・検証結果を知る       | [docs/status.md](docs/status.md)                             |
| コードの書き方・ページの追加方法を知る | [開発ガイド](docs/development.md)                            |
| なぜこの設計にしたかを知る             | [設計判断とADR](docs/architecture/README.md)                 |
| 納品の条件を確認する                   | [仕様](docs/spec.md)                                         |
| サイトの目的・顧客サイトへの展開を知る | [プロジェクト概要](docs/product/project-overview.md)         |
| 事業・料金・契約の方針を確認する       | [事業ガイドライン](docs/business/紬_ビジネスガイドライン.md) |
| 資料全体から探す                       | [docs/README.md](docs/README.md)                             |
