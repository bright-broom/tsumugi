# 0012 — 単一のアプリをリポジトリルートから操作する

2026-09-14 / 採用。`site/src/` の位置とルートの整理をユーザーが指示した。ADR 0002の配置を更新し、ADR 0004の依存方向は維持する。

## 背景と決定

現状は単一のNext.jsアプリと独立した経営モデルで、複数アプリのワークスペースではない。`site/` にpackage.json・設定・ソース・生成物が集まり、ルートとアプリの作業ディレクトリ、VercelのRoot Directory、CI、文書の相対パスが二重になっていた。

Next.jsが標準で対応するルート直下の `src/` と `public/` を使う。アプリのレイヤーは変更せず、`@/` は `src/` を指す。設定・実装・生成物の境界を明確にする。

| 移動前 | 移動後 | 責務 |
|---|---|---|
| site/src | src | アプリの実装・データ・テキスト |
| site/styles | src/styles | Tailwindとデザイントークン |
| site/assets | src/assets | 生成に使う元画像 |
| site/public | public | そのまま配信するファイル |
| site/scripts | tools/scripts | 開発・ビルド・構造検査 |
| site/verify | tools/verify | 納品物の静的・ブラウザ検査 |
| site/tests | tests | アプリ・開発基盤のテスト |
| site の補助設定 | config | ESLint・Vitest・Prettier |
| site/verify-report*.json | .artifacts/verification | 検査結果（Git管理外） |
| site/shot-*.png | .artifacts/screenshots | 作業用画像（Git管理外） |
| site/README.md | docs/development.md | 詳細な開発手順 |

Next.js・TypeScript・npm・Vercelの起点となる設定はルートに残す。`out/` と `.next/` は各ツールの標準出力先のままGit管理外にする。ローカル環境設定はルートへ移し、移動前のキャッシュと接続情報の控えは `.artifacts/` に保持する。新たなモノレポ基盤や依存ライブラリは導入しない。

## パスと検査の一貫性

ビルドツールは `tools/paths.ts` からプロジェクトルートを参照する。呼出し元のカレントディレクトリに依存させない。アプリの実測読み取りはNext.jsの起動ルートから `.artifacts/verification/verify-report.json` を読む。静的検査の結果と全項目の結果は別ファイルのまま維持し、未計測の数字を生成しない。

構造検査は `src/` と `tools/` を対象にし、未定義のソース層も拒否する。中央スタイル検査は `src/styles/` を正規の置き場所として認め、それ以外のアプリ内CSS・静的インライン指定を拒否する。テストの参照先、開発監視、OGP生成も新しい場所に揃える。

GitHub ActionsとDependabotはルートで動作する。`npm run validate` は価格モデルの9件も実行し、Vercel側でも同じ検査を通す。VercelのRoot Directoryは `site` から未指定（APIではnull）へ更新する。これは次回のビルド起点を変える設定で、既存の配信済みHTMLは変更しない。旧コミットを再配備する場合は当時のRoot Directoryを指定する。

Next.jsの生成ルールはルートのAGENTS.md末尾へ統合し、CLAUDE.mdはそれを参照する。歴史資料・過去のADRにある旧パスは当時の記録として残し、現行の操作手順とリンクを更新する。

## 検証

ルートでnpm ci、型・構造・文言・スタイル検査、lint、単体122件、経営モデル9件、ビルド・静的358 PASSを確認。移動前後の出力50ファイル（HTML21枚・CSS・画像・サイトマップ等）のSHA-256がすべて一致し、実行時JS 0バイトを維持した。元の画像や文言は再生成・編集していない。

ブラウザを含む全検証603 PASS / WARN 1 / FAIL 0と、3001番での開発起動を確認した。既存VercelプロジェクトのRoot Directory=nullをAPIで確認。GitHub・Vercelの配備結果は現状資料に記録する。既知のWARNは仮の事業者情報によるもので、今回の構造変更では解消しない。
