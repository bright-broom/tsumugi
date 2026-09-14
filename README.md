# 紬（つむぎ）

事業の土台づくりと日々の改善を支えるサービスサイト。Next.js・React・TypeScriptで構築し、21ページを静的HTMLとして配信します。公開ページの実行時JavaScriptは0バイトです。

```text
.
├── src/                 アプリケーション
│   ├── pages/           Next.jsのルート入口
│   ├── application/     ページデータの組み立て
│   ├── views/           ページの表示
│   ├── layouts/         共通レイアウト
│   ├── components/      共通部品
│   ├── content/         料金・事業データ・図解
│   ├── i18n/            表示テキストの中央管理
│   ├── routing/         URLの登録と解決
│   ├── lib/             共通の小さな処理
│   ├── styles/          Tailwind・デザイントークン
│   └── assets/          生成に使う元画像
├── public/              そのまま配信する素材
├── config/              ESLint・Vitest・Prettierの設定
├── tests/               アプリと開発基盤のテスト
├── tools/               ビルド・検査・料金モデル
├── docs/                仕様・設計判断・事業資料
└── .artifacts/          検査レポート等（Git管理外）
```

`package.json`、`next.config.ts`、`tsconfig.json`、`vercel.json` は各ツールが参照する起点としてルートに置いています。ビルド結果は `out/`、Next.jsのキャッシュは `.next/` に生成されます。

## 起動

リポジトリルートで実行します。Node.jsのバージョンは `.nvmrc` に固定しています。

```sh
nvm install && nvm use
npm install --global npm@12.0.2
npm ci
npm run dev
```

通常は `http://localhost:3000`。既存の確認環境は `npm run dev -- --port 3001 --hostname 127.0.0.1` で起動します。

## 検査と配信

```sh
npm run validate                         # 型・構造・lint・テスト・ビルド・静的検査
npx playwright install chromium          # 初回のみ
npm run verify                           # ブラウザを含む納品検査
npm run deploy:preview                   # Vercelプレビュー
```

VercelのRoot Directoryは未指定（リポジトリルート）、配信対象は `out/`。公開事業者情報とフォームは準備中です。開発サーバーの更新用JavaScriptは、静的な納品物には含まれません。

## 作業の入口

- [作業上の決まり](AGENTS.md)
- [現在の状態・残課題](docs/status.md)
- [開発ガイド](docs/development.md)
- [資料の目次](docs/README.md)
- [サイトの目的・ページ構成・顧客サイトへの展開](docs/product/project-overview.md)
- [設計判断](docs/architecture/README.md)

価格は `src/content/prices.ts`、テキストは `src/i18n/`、見た目は `src/styles/` を正本にします。
