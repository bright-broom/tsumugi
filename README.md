# 紬（つむぎ）サービスサイト

小規模事業者向けホームページ制作の自社サイト。
**実行時 JavaScript 0バイト**が製品の主張そのものなので、そこを崩す変更はしない。

## 中身

| | |
|---|---|
| `svc-astro/` | **本体。** Astro 5 + React 19 + TypeScript。21ページ |
| `svc/native/*.css` | **CSSの正本。** Astro 側はここを読んでビルドする（コピーを作らない） |
| `svc/verify.py` | **検査。製品の一部。** 581項目。1つでも落ちたら納品しない |
| `svc/build.py` ほか | 旧 Python 版。移植が正しいことの証拠として残してある |

## 動かす

```bash
cd svc-astro
npm install
npm run dev      # http://localhost:4321
npm run build    # css → prices.json → astro build → dist/
```

## 検査する（ビルドのあと）

```bash
cd svc
pip install playwright        # 初回だけ
playwright install chromium   # 初回だけ
python verify.py --dist ../svc-astro/dist
# → PASS 581 / WARN 1 / FAIL 0 なら納品可
```

WARN 1 は `PLACEHOLDER=True`（電話番号・住所が仮）。公開前に潰す既知の1件。

| 旗 | |
|---|---|
| `--dist <path>` | 検査するディレクトリを差し替える |
| `--write` | LCP実測値を、検査した dist を作った側の設定に書き戻す |
| `--lcp` | ブラウザ計測を含める |

## 触るときの注意

- **金額の正本は `svc-astro/src/data/prices.ts`。** ここを直すと全ページの数字が動く。
  `npm run build` が `prices.json` を書き、`verify.py` がそれとページを突き合わせる。
- **`RUN` や `BUILD` を添字で引かない。** 必ず `run('run_standard')` のように key で引く。
  プランを1つ足したときに、添字で引いていた箇所が静かにずれて全ページの月額が下振れした事故がある。
- **`astro.config.mjs` の `build.format: 'file'` は必須。**
  既定の `'directory'` だと `dist/terms/index.html` になり、内部リンクと検査が両方壊れる。
- **アイランド（`client:load` など）を足すと実行時JSが載る。** 主張が崩れるので、足す前に検査を通すこと。
- **CSSは `svc/native/` を直す。** `svc-astro/public/theme.css` はビルドの生成物。
