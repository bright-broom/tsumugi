# 0009 — Tailwind CSSで共通テーマと全スタイルを中央管理する

- 日付：2026-09-14
- 状態：採用

## 問題と変更後の状態

従来は6枚のCSSを文字列連結し、ページ内の余白・文字サイズとOGP画像のCSSはTypeScriptにも分散していた。利用者の「CSSをすべてTailwindのグローバル管理に」という指定に合わせ、85個のデザイントークンをTailwindのテーマにし、公開ページの見た目を `styles/globals.css` に集約する。

全21ページは同じ `/theme.css` を読み、ページと共通部品には意味を持つクラス名を渡す。従来の約1,900個の宣言のうち約9割をTailwindの `@apply` に置き換えた。グラデーション、生成内容、SVG描画、複雑なアニメーションなどはTailwindが扱える通常のCSSとして同じ管理下に置く。Preflightは導入せず、承認済みのリセット・見た目・ネイティブ操作を維持する。

## 管理の境界

| 対象 | 正本・役割 |
|---|---|
| 色・書体・寸法・動きの85トークン | `styles/design.tokens.json` → `tokens.css` の `@theme static`。独自の `--nah-*` から `--color-*`・`--spacing-*`・`--font-*` 等のTailwind名前空間に統一 |
| 公開ページ | `globals.css` が唯一の入口。`base.css`・`components.css`・`responsive.css`・`home.css`・`footer.css`・`pages.css` を順序付きで読み込む |
| レイヤー | `theme → base → components → screens → overrides → utilities`。Tailwind内部のproperties層はコンパイラが管理 |
| スタイルの使用 | 共通クラス内の `@apply`。`source(none)` で自動スキャンを止め、ページ内の文字列とユーティリティ名の偶然の一致を防ぐ |
| SVG | 座標・viewBox・図形属性は描画データ。意味を持つ色は共通CSSの `--fig-*` からテーマを参照 |
| 動的な数値 | 比較バーの比率と表幅だけをCSS変数で渡す。通常のstyle属性とCSS Modulesは `check-styles.ts` が拒否 |
| OGPとアイコン描画 | `styles/og.css` を同じTailwind CLI・テーマでコンパイル。生成器内にCSSを重複定義しない。公開ページ用CSSには含めない |

## ビルド・開発・依存関係

Tailwind CSS / CLI 4.3.3を開発依存として固定する。NextのCSSチャンクではなくCLIで静的な `public/theme.css` を生成し、既存の `_document.tsx` と静的書き出しを維持する。Tailwindによるブラウザ用スクリプトの追加はない。Nextの `out/_next/` を除去するpostbuildの仕様とも両立する。

`npm run dev` はトークン生成・CSS生成の成功後にNextとTailwind監視を起動する。JSONの変更はトークンを再生成し、CSSの変更はTailwindが再コンパイルする。CSSの画面反映には再読み込みを使う。終了時は子プロセスと監視を閉じる。ビルドでは引き続きトークンの同期を検査し、未同期やCSSコンパイル失敗を黙って通さない。

`@parcel/watcher` のネイティブ実装は配布済みバイナリを使い、ソースビルド用install scriptは明示的に無効にする。npm 12.0.2では既存のlockを更新する際にOxideのWASM同梱依存の解決が `EALLOWREMOTE` になる場合があった。一時ディレクトリで公式レジストリから同梱依存のlock情報を補完し、プロジェクトの許可設定は緩めずに通常の `npm ci` が成功することを確認した。依存バージョンの追加変更はない。

## 検証

- 型・依存・文言・中央管理の検査、ESLint、Vitest 120件。
- 空のディレクトリから通常の `npm ci` 成功、npm audit 0件。
- 全21ページ × 幅320・390・768・1440pxで、全要素の計算済みスタイルと配置が移行前に一致。全ページの画面を比較。共有カードとPNGアイコン23枚は同じ環境で移行前後のピクセル一致を確認（生成先は一時ディレクトリ）。
- JSONからテーマ、共通CSSから配布CSSへの自動更新と、元の内容への復元を確認。ローカルの3001番でHTTP 200。
- 静的検査360 PASS、ブラウザを含む608 PASS / WARN 1 / FAIL 0。全21ページの実行時JavaScriptは0バイト。

コントラスト検査に、CSS・フォントの準備を待たない競合が見つかった。静的HTMLのDOMContentLoadedだけでは十分ではなく、非表示のナビ等を誤って検査対象に数える場合があった。読込後の同じ4ページで比較すると、移行前後とも137対象で色・比率が一致する。検査も読込後に統一したため、以前の610件から608件へ更新した。検査対象を削除した結果ではない。

今回はCSSコンパイラ・変数名・静的インライン指定を変更するため、HTML/CSSのバイト一致は条件にできない。変更対象外の画像・フォント等を保持し、画面と操作を直接比較する。`works.html` の実測検査件数は検証後のビルドで608へ更新する。

## 参照

- [Tailwind公式：テーマ変数](https://tailwindcss.com/docs/theme)
- [Tailwind公式：ディレクティブと @apply](https://tailwindcss.com/docs/functions-and-directives)
- [Tailwind公式：CLI](https://tailwindcss.com/docs/installation/tailwind-cli)
- Next 16.3.5同梱ドキュメント：`node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` のPages Router部分
