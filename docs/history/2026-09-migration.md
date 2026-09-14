# 移行の記録（2026年9月・Python／Astro → Next.js）

> 文中のコードのパス（`src/…` `scripts/…` `verify/` `styles/` `public/` `out/`）は `site/` からの相対。

Python のジェネレータ（`svc/`）→ Astro（`svc-astro/`）→ **Next.js（`site/`）** の順に移した。
旧版はコミット `01f39d4`（`main`）に残っている（`git show 01f39d4:svc/verify.py` のように読める）。

移植が正しいかは、見た目ではなく**同じ入力に対する出力の一致**で確かめた。

| 何を | どう比べたか | 結果 |
|---|---|---|
| 21ページの HTML | Astro 版の出力と、タグ・属性・本文の並びで突き合わせ（空白・属性の順序・図の marker id の番号は見ない） | **21/21 一致**（意図して直した `contact.html` の文言1か所を除く） |
| robots.txt / sitemap.xml / theme.css | バイト比較 | 一致（theme.css は生成元パスのコメント2行だけが違う） |
| 検査 | Python 版 `verify.py` と TS 版 `verify` を、同じ出力に対して項目ごとに突き合わせ | **582件すべて一致**（並び順も同じ） |
| Next.js 版の出力 | Python 版・TS 版の両方の検査にかける | どちらも **PASS 581 / WARN 1 / FAIL 0** |
| OGP画像 | 同じマシンで Python 版と TS 版（`scripts/og.ts`）を実行して比較 | 24ファイルすべてピクセル一致 |
| デザイントークン | 旧 `build-tokens.mjs` と TS 版の出力 | バイト一致（見出しコメントのパスだけ更新） |
| 出力の再現性 | 同じ入力で2回ビルドして HTML のハッシュを比較 | 一致 |

移行の途中で見つけて直したこと：

- **図の marker id が通し番号だった。** ページを並列に書き出す Next.js ではビルドのたびに番号が変わる。aria-label から決まる値に変えた
- **Next.js が head に付ける `data-next-head=""` で、検査の `<title>` と JSON-LD の照合が外れた**（FAIL 21件）。JS を配らない以上は役目のない印なので、`postbuild` で消している
- **React は `ほか{n}項目` を `ほか<!-- -->5<!-- -->項目` と出す。** テンプレートリテラルで1つにする決まりにして、`postbuild` で検出する
- **OGP画像の金額と返信の約束が、カードにだけ手書きで残っていた。** `prices.ts` / `config.ts` から引くようにした（いまの値では出力は同じ）
- **OGP画像の生成が、出力先のディレクトリを丸ごと消していた。** 上書きに変えた

残っている注意：

- **コミット済みの OGP画像（`public/og/`）は別のマシンで作ったもの。** この Mac で `npm run og` を実行すると、日本語の書体の違い（Noto Sans CJK JP と Hiragino Sans と見ている）で全PNGが差分になる。どちらの字形を正本にするか決めてから作り直すこと
- **ページに出す検査の件数（`works.html` の「581項目」）は、ビルド時点の `verify-report.json` から取る。** 数字を最新にするには `npm run build && npm run verify && npm run build` の順に回す

続けて、`src/` を層に分けた（[ADR 0002](../architecture/0002-directory-layers.md)）。この変更の前後でも、ビルドの出力はバイト単位で同一だった。
