# 言語を追加する手順

顧客サイトに 2 つ目の言語（例：英語）を載せる手順。判断の理由は [ADR 0081](../architecture/0081-build-time-locales.md)。紬の自社サイトは日本語だけで公開している（未承認の翻訳を載せない）。

## しくみ

- 1 回のビルドで 1 言語を出力する。既定の言語（最初の言語）はサイトの起点（`/price.html`）、追加の言語はそのパスの下（`/en/price.html`）に置く。
- `npm run build` が既定言語をビルドした後、`build-locales` が追加言語を別の出力先でビルドし、`out/en/` へ統合する。最後に `check-locales` が全言語の出力を検査する。
- テーマ・画像・フォントは全言語で共有する。共有カード（OGP）は言語ごとに `public/og/<言語>/` に置く。
- 2 言語以上のときだけ、各ページに hreflang（全言語と x-default）と、フッターの言語の切り替えが出る。1 言語のサイトの出力は変わらない。

## 手順

1. **承認済みの翻訳を受け取る**。日本語のカタログ（`src/i18n/locales/ja/`）と同じ構成で `src/i18n/locales/en/index.ts` を作り、型 `Translation` に合わせて書く。機械翻訳をそのまま載せない。
2. **登録する**。`src/i18n/locales/index.ts` の `CATALOGS` に `en: translated('en', en)` を加える。日本語と比べて、キーの過不足・リストの長さ・差し込み値（`{price}` など）・ページへのリンク（`@route:`）が違えばビルドが止まる。
3. **公開する言語に加える**。`src/content/config.ts` の `PUBLISHED_LOCALES` を `['ja', 'en']` にする。
4. **共有カードを作る**。`SITE_LOCALE=en npm run og` で `public/og/en/` に作り、目視で確認してコミットする（書体は ADR 0047 の環境）。
5. **ビルドと検査**。`npm run validate`（既定言語と追加言語の静的検査）、`npm run verify -- --mode production` と `npm run verify:locales -- --mode production`（ブラウザを含む全項目）。追加言語の結果は `.artifacts/verification/verify-report.en.json` に別に保存される。
6. **法務文面と公開判断を言語ごとに記録する**。翻訳した規約・特定商取引法の表記は、その言語の文面として確認し、`config.ts` の `LEGAL_APPROVALS_BY_LOCALE.en` に記録する。日本語の承認は英語の文面には使えない。
7. **表示を確かめる**。英語は語が長く、ボタン・表・見出しの折り返しが変わる。全ページを 320 / 390 / 1440px で確認する（[リデザイン手順](redesign-guide.md) の比較を言語ごとに行う）。

## 翻訳しない固有名詞

屋号・氏名・住所などを日本語のまま載せる場合は、`check-locales` に許可する文字列を渡す（例：`LOCALE_ALLOWED_JAPANESE='紬|作田 敏希' npm run check:locales`）。許可していない日本語が英語のページにあればビルドは止まる。

## 開発サーバー

`npm run dev` は既定言語だけを配る。追加言語を確かめるときは `npm run build` のあと `out/` を静的に配って `/en/` を開く。
