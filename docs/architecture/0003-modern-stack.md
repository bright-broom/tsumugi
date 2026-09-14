# 0003 — JavaScript 0 バイトを維持した開発基盤の最新化

- 日付：2026-09-14
- 状態：採用

## 判断

利用者は React・Next.js・TypeScript・Vercel への統一と、実行時 JavaScript 0 バイトの維持を選択した。
旧 Python／Astro 実装の削除と `.ts`／`.tsx` への移行は完了していた。Pages Router を維持し、追加のフレームワーク移行は行わない。
Next.js 16.3.5、React 19.3.0 は調査時点の npm `latest` と一致した。

## 変更

- 型検査・ビルドに TypeScript 7.0.2 を採用。`allowJs: false`、strict、`noUncheckedIndexedAccess` を維持する。
- ESLint は TypeScript 6 の API が必要なため、Microsoft の公式併用方式に従い `@typescript/native: npm:typescript@7.0.2` と `typescript: npm:@typescript/typescript6@6.0.3` を使う。`tsc` は 7、`tsc6` は互換用となる。
- ESLint 10 は React/import/a11y プラグインの peer dependency に適合しないため、互換範囲の最新である 9.39.5 を採用する。エラーを無視するオプションは使わない。
- Node.js は Vercel 対応の LTS 24 系、npm は 12.0.2 へ統一する。古い npm 10.9.2 が作る optional dependency の欠落を避け、lockfile をクリーンな状態で再生成した。利用者のグローバル Node の設定は変更しない。
- 手動でコピーした SVG パスを `lucide-react` に置き換える。HTML 文字列の経路も `react-dom/server` で同じ SVG を生成する。
- clsx をクラスの合成、Zod を実測レポートの構造検証、Vitest を料金計算・描画・レポート入力のテストに使う。
- Playwright を最新化し、既存の全ページの検証を継続する。Prettier は設定と実行コマンドを用意し、既存の大量の整形差分を今回の変更に混ぜない。
- GitHub Actions は型・lint・単体テスト・ビルド・静的検査とブラウザ実測を実行する。Dependabot は依存更新を PR として提示する。

## Dependabot の更新範囲

2026-09-14、PR #6 の ESLint 10.10.0 への更新で、`eslint-plugin-react` 7.37.5 の `react/display-name` が `contextOrFilename.getFilename is not a function` を出し、CI とローカルの lint が停止した。ESLint を 9.39.5 に戻し、同じ PR に含まれる `@types/node` も実行環境の Node 24 と一致する 24.13.4 に戻す。

`.github/dependabot.yml` では、この2依存だけ `version-update:semver-major` を除外する。マイナー・パッチ更新と、その他の依存の更新は引き続き PR で受け取る。
ESLint の次のメジャーは Next.js のプラグインが対応してから、Node の型定義の次のメジャーはローカル・CI・Vercel の実行環境を移行するときに、明示的に更新する。どちらもクリーンインストールと全検査を通して判断し、peer dependency や lint のエラーを無視しない。
ESLint 9.39.5 は npm がサポート終了の警告を出すため、互換性を保つための暫定的な維持とする。Next.js 側の対応時に更新を再評価する。

## Vercel と静的配信

`site/vercel.json` は Framework Preset を Other（`framework: null`）にし、Next.js で生成して postbuild で検証した `out/` だけを配信する。
Next.js 用のホスティングアダプターに配信ファイルを再構成させず、他社ホストに渡すものと同じ静的 HTML を使う。
`.html` の既存 URL を保ち、すべてを index に戻す SPA 用の rewrite は設定しない。

プレビューは確認用。本番の事業者情報・問い合わせ先・独自ドメインは別途設定が必要。
Vercel のプレビュー用ツールバーがスクリプトを注入する場合、プロジェクト側でも無効にし、配信された HTML を再検証する。

## 依存の修正版指定

Vercel CLI 59.16.0 の依存には既知の脆弱性を持つバージョンの固定があったため、`package.json` の `overrides` で修正版を指定する。
対象は once、ajv 8、minimatch 10、path-to-regexp 6/8、smol-toml、tar 7、undici 7 未満、js-yaml 4、esbuild 0.27。
undici 5 は修正版の 6.28.0 へ上げる。このサイトは静的配信で、CLI のログイン・プロジェクト取得・プレビュー配備が検証対象。
新しい CLI がこれらを取り込んだ際は不要な override を削除し、`npm ci`・`npm audit`・配備を再確認する。

npm 12 の install scripts は `allowScripts` で esbuild・unrs-resolver・fsevents の確認済みバージョンに限定する。依存更新時は対象の script とバージョンを確認して更新する。

## 残る HTML 文字列の扱い

本文と図に含まれる HTML／SVG の文字列は TypeScript 内のコンテンツ表現であり、旧 Python や Astro の実行環境ではない。
既存の図と文言を保全するため、全面的な JSX 書き換えは行わない。外部や利用者の入力を `raw()` に渡してはいけない。

## 参照

- [Next.js の TypeScript 対応](https://nextjs.org/docs/app/api-reference/config/typescript)
- [Microsoft: TypeScript 7 と 6 の併用](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0)
- [Vercel の Node.js バージョン](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel の静的設定](https://vercel.com/docs/project-configuration/vercel-json)
- [GitHub: Dependabot の ignore 設定](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#ignore)
