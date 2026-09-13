# 紬（つむぎ）サービスサイト

小規模事業者向けホームページ制作の自社サイト。
**実行時 JavaScript 0バイト**が製品の主張そのものなので、そこを崩す変更はしない。

## 中身

| | |
|---|---|
| `site/` | **本体。** Next.js 16（Pages Router）+ React 19 + TypeScript。21ページを静的HTMLに書き出す |
| `site/verify/` | **検査。製品の一部。** 581項目。1つでも落ちたら納品しない |
| `site/styles/` | **CSS とデザイントークンの正本** |
| `site/DESIGN.md` | 設計の記録（主張・値付け・検査項目・デザインの出所・移行の記録） |
## 動かす

```bash
cd site
npm install
npm run dev      # http://localhost:3000
npm run build    # トークン同期の検査 → public/ の生成 → next build → postbuild → out/
```

## 検査する（ビルドのあと）

```bash
cd site
npx playwright install chromium   # 初回だけ
npm run verify
# → PASS 581 / WARN 1 / FAIL 0 なら納品可
```

WARN 1 は `PLACEHOLDER=true`（電話番号・住所が仮）。公開前に潰す既知の1件。

| 旗（`npm run verify -- <旗>`） | |
|---|---|
| `--dist <path>` | 検査するディレクトリを差し替える（既定は `out/`） |
| `--static` | 静的検査のみ（ブラウザ不要・CI向け） |
| `--write` | LCP実測値を `src/data/config.ts` に書き戻す |

## 触るときの注意

- **金額の正本は `site/src/data/prices.ts`。** ここを直すと全ページの数字が動く。
  `verify` は同じファイルを読んで、ページに出ている金額と突き合わせる。
- **`RUN` や `BUILD` を添字で引かない。** 必ず `run('run_standard')` のように key で引く。
  プランを1つ足したときに、添字で引いていた箇所が静かにずれて全ページの月額が下振れした事故がある。
- **全ページに `export const config = { unstable_runtimeJS: false }` が要る。**
  忘れると実行時JSが載る。`postbuild` がビルドを落とすので気づけるが、足すときは必ず `npm run build` を通すこと。
- **App Router に移さない。** 静的書き出しでも全ページに約173KBのJSが載り、主張が崩れる（`site/README.md`）。
- **値を混ぜる文字列はテンプレートリテラルで1つにする。** `ほか{n}項目` は `<!-- -->` が挟まり、検査の照合がずれる。
- **ページ名はフラットな `.html`。** 内部リンクも `href="terms.html"` のまま。クリーンURLはホスト側の設定でやる。
- **CSSは `site/styles/` を直す。** `site/public/theme.css` はビルドの生成物。
