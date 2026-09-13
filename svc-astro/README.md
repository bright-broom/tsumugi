# 紬サイト ── Astro + React + TypeScript 版（移行中の「器」）

`../svc`（Python のジェネレータ）を、React・TypeScript・Vercel に移すための土台。
**まだ器だけ。** 21ページのうち3ページを移し終えた段階。

```
npm run build          # public/theme.css を用意して astro build
npm run check          # astro check（TypeScript と .astro の型検査）

# 検査は Python 版のものをそのまま使う。書き直さない。
cd ../svc && python verify.py --dist ../svc-astro/dist --scaffold
```

---

## なぜ Astro なのか（Next.js ではなく）

最小構成でビルドして測った。

| | index.html が読む JS |
|---|---|
| いまの紬（Python生成） | **0 バイト** |
| **Astro + React + TS**（アイランド無し） | **0 バイト** |
| Astro（`client:load` を付けたページだけ） | 約59KB gzip |
| Next.js 15 `output: 'export'` | **102 KB**（全ページ・減らせない） |

サイトの主張がここに乗っている。

- `spec.html`「実行時のプログラム ありません（0バイト）」
- `owned.html` 所有の4要素 ③地盤「実行時JSが0バイトなので、どのサーバーにも置けます」
- `verify.py` の「実行時JSなし」が全ページで通ること

**Next.js に移すとこの3つが同時に崩れる。** 速度の話ではなく、売り文句の根拠の話。

`src/components/TotalCompare.tsx` が実証。React + TypeScript で書いてあるが、
`client:` を付けていないのでビルド時にHTMLへ焼かれ、**script タグは1つも増えない**
（残る1つは JSON-LD＝データであってプログラムではない）。

> `dist/_a/client.*.js` が出力に残るが、**どのHTMLからも参照されていない。**
> React 連携を入れている以上ランタイムは用意されるが、
> アイランドを置かない限り誰にも配られない。

---

## 何が「一致」しているか

移植が正しいかどうかは、**Python版の出力と本文テキストを突き合わせて**確かめている。
見た目の印象ではなく、文字列の一致で見る。

| ページ | Python版 | Astro版 | |
|---|---|---|---|
| privacy.html | 1,034字 | 1,034字 | **一致** |
| flow.html | 1,338字 | 1,338字 | **一致** |
| terms.html | 1,607字 | 1,607字 | **一致** |

```
python3 - <<'PY'
import re, html
def text(p):
    s = open(p, encoding="utf-8").read()
    s = re.sub(r'<script.*?</script>', '', s, flags=re.S)
    s = re.sub(r'<svg.*?</svg>', '', s, flags=re.S)
    m = re.search(r'<main.*?</main>', s, re.S)
    return re.sub(r'\s+', '', html.unescape(re.sub(r'<[^>]+>', ' ', m.group(0))))
for n in ("privacy", "flow", "terms"):
    a = text(f'../svc/dist/{n}.html'); b = text(f'dist/{n}.html')
    print(n, "一致" if a == b else "差あり")
PY
```

---

## 構成

| | |
|---|---|
| `src/data/config.ts` | 屋号・連絡先。`svc/config.py` の移し替え |
| `src/data/prices.ts` | **価格の単一の出所。**`as const` で値から型が付く。添字ではなく `build(key)` / `run(key)` で引く |
| `src/data/icons.ts` | `svc/icons.py` から機械的に生成。手で編集しない |
| `src/data/nav.ts` | ナビ・フッター・業種の並び |
| `src/layouts/Base.astro` | **器の本体。**head / OGP / JSON-LD / ヘッダー / フッター / 固定CTA |
| `src/components/*.astro` | Section / Table / Note / Calc / Flow / Stats / Acc / Cta / Entry / Plans / Icon |
| `src/components/TotalCompare.tsx` | **React + TS の実証。**ビルド時レンダリングで実行時JSは0 |
| `src/pages/*.astro` | 1ファイル＝1ページ |
| `scripts/build-css.mjs` | `../svc/native/*.css` を読んで `public/theme.css` を作る。**CSSの正本は svc 側のまま** |

`astro.config.mjs` の `build.format: 'file'` は必須。
既定の `'directory'` だと `dist/terms/index.html` になり、
いまの内部リンク（`href="terms.html"`）と検査の両方が壊れる。

---

## 残っている18ページ

index / owned / price / unlimited / source / cost-cut / subsidy / spec /
works / faq / about / contact / legal /
restaurant / koumuten / salon / shigyo / 404

移す順番（壊さないために）：

1. **図（`diagrams.py`）を先に。** 6本＋スマホ用6本。`.astro` で SVG を返すだけ。
   これが済むと index / owned / price / subsidy / cost-cut がまとめて動く
2. 短いページから（legal → about → works → contact）
3. 業種4枚（`IND_DATA` を `src/data/industries.ts` に移せば1テンプレートで4枚出る）
4. 大物（index / price / owned）
5. `prices.py` → `prices.ts` の一本化は**最後**。
   ここを動かすと全ページの数字が動く。検査29「価格の一致」が守ってくれるが、最後が安全

移すたびに `python verify.py --dist ../svc-astro/dist --scaffold` を通す。
全ページ揃ったら `--scaffold` を外し、**581 PASS が出ることを確認**してから Python 版を捨てる。

---

## Vercel に載せるとき

- 静的出力なので **Hobby でも足りる。** Pro が要るのは社内ツール側
- **公開URLは独自ドメインにする。** `◯◯.vercel.app` のまま渡すと、
  全プランに書いた「独自ドメイン取得（初日からお客様の名義）」が守れない。
  vercel.app は公開前の確認用に使う
- 顧客ごとに顧客名義の Vercel アカウントへ。**土地も顧客のもの**にしておく
