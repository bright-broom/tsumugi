# アーキテクチャ

コードを触るときの決まり（コマンド・書き方・置き場所）は [docs/development.md](../development.md)。
ここには、**なぜそう決めたか**を残す。

## 決定の記録（ADR）

| # | 決めたこと |
|---|---|
| [0001](0001-pages-router.md) | Next.js は Pages Router で書き、静的HTMLに書き出す（実行時JS 0バイト） |
| [0002](0002-directory-layers.md) | `src/` を層に分け、案件ごとに差し替える中身を `content/` に集める |
| [0003](0003-modern-stack.md) | JavaScript 0 バイトを維持し、TypeScript 7・開発ライブラリ・CI・Vercel を整備する |
| [0004](0004-content-and-routing.md) | 文言・ルートの正本、静的ページ入力と表示テンプレートを分離する |
| [0005](0005-temporary-hero.md) | 国生みの生成画像を SVG に内包し、ホームのヘッダー直下へ暫定配置する |
| [0006](0006-japanese-modern-header.md) | ヘッダーを生成りと藍墨、端末の明朝で構成し、静的な全体メニューを共通部品にする |
| [0007](0007-home-editorial-layout.md) | ヒーロー以下を現代的な本文レイアウトに刷新し、図解と情報を保持する |
| [0008](0008-icon-rich-footer.md) | フッターを明るい面と32個のアイコン、ブランド文字、用途別の案内で統一する |

| [0009](0009-global-tailwind.md) | CSSをTailwindの共通テーマ・グローバルクラスへ集約し、開発監視と静的な配布を両立する |
| [0010](0010-pricing-decision-model.md) | 月140時間を前提に、公開価格と分離した料金・採算の判断モデルを検証する |

新しい決定は `NNNN-短い名前.md` で足す。決定を覆すときは古い記録を消さず、状態を「置き換え（NNNN）」にして新しい番号を足す。

> 文中のコードのパス（`src/…` `tools/scripts/…` `tools/verify/` `src/styles/` `public/` `out/`）は リポジトリルートからの相対。

---

- [0011 新料金体系の採用と資料同期](0011-adopt-pricing-140h.md)

- [0012 単一アプリをルートから操作する構成](0012-root-project-layout.md)

- [0013 未使用コードの整理と再混入の検査](0013-dead-code-cleanup.md)

- [0014 生成り・墨・朱の3色システム](0014-three-color-system.md)

- [0015 アクセントを琥珀色へ変更](0015-amber-accent.md)

- [0016 琥珀と調和するメイン・サブカラー](0016-warm-base-palette.md)

- [0017 情報を意味のある単位で共有する](0017-information-architecture.md)

- [0018 説明を具体的な仕事内容に揃える](0018-plainspoken-copy.md)

- [0019 画像内コピーもi18nから描画する](0019-complete-i18n.md)

- [0020 内容に合う部品と自然な読み順](0020-natural-components.md)

- [0021 料金の読み順と和欧文の表記](0021-pricing-and-typesetting.md)

- [0022 料金モデルも TypeScript の検査対象に含める](0022-pricing-typescript.md)

- [0023 図解を型付き React / SVG に移す](0023-react-diagrams.md)

- [0036 社内ツールを tools/ops の CLI とし、見積もりは公開料金だけで計算する](0036-internal-ops-tools-and-estimates.md)

- [0037 顧客運用の指標は「0・未計測・欠損」を型で分け、月次レポートは確認前の下書きとして出す](0037-customer-metrics-and-monthly-reports.md)

## 技術的な判断とその理由

| 判断 | 理由 |
|---|---|
| **デザイントークンを JSON の正本から生成する** | 色や寸法を CSS に直接書くと、同じ値が何か所にも散る。`design.tokens.json` を正本にして `npm run build` と `verify` の両方が同期を検査するので、生成物とのずれが納品前に必ず止まる |
| **`@layer base, components, screens, overrides`** | セレクターの強さの競争を避ける。上書きしたいときは層を選べばよく、`!important` を積む必要がない |
| **Container Queries（960/520px）** | カードの列数を「画面の幅」ではなく「置かれた場所の幅」で決める。サイドバーの中や顧客サイトの別レイアウトへそのまま持っていける |
| **日本語は端末の書体（本文はゴシック、屋号は明朝）** | 本文は元ガイド、屋号は ADR 0006 に従う。日本語の外部フォント取得は不要。初期版の LCP 実測は0.30秒 |
| **Next.js（Pages Router）で書いて、静的HTMLに書き出す** | 部品と型は React・TypeScript で持ち、納品物は素のHTML。App Router は静的書き出しでも全ページに約173KB（gzip）のJSを配るので使わない（[ADR 0001](0001-pages-router.md)）。実行時JSが0バイトになり、LCPが最速になる。どのホスティングにも置ける |
| **実行時JavaScript 0バイト** | `/spec` で「0バイト」と書いている以上、`verify` が機械的に検証している。インラインのイベントハンドラも禁止 |
| **ホームのヒーロー画像を暫定採用** | 利用者指定の国生みの画像を SVG に内包し、ヘッダー直下に配置。従来の画像なし方針をホームについて変更した。寸法指定・先頭画像の優先読み込み・LCP検査を維持（[ADR 0005](0005-temporary-hero.md)） |
| **タップ領域は44px（WCAGの最小は24px）** | 読み手が50〜60代の店主・社長なので、最低基準ではなく実用基準を採った |
| **`llms.txt` を出力しない** | 根拠がないため。`verify` が「生成されていないこと」を検証している |
| **`FAQPage` 構造化データを使わない** | 2026年5月7日に表示終了。`verify` が混入を検出する |
| **ページ名をフラットな `.html`** | どのホスティングでも確実に動く。クリーンURLはホスト側の設定でやる |
