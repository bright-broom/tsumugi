# 0047 — OGP 画像の生成環境を macOS のヒラギノ角ゴシックに固定し、再現性を検査する

日付：2026-09-16。状態：採用（現行の字形を正本とする）。別 OS での再現に使う書体の選定は未決（オーナー判断）。関連：[#37](https://github.com/bright-broom/tsumugi/issues/37)、[ADR 0014](0014-three-color-system.md)。

## 背景

`tools/scripts/og.ts` は Playwright の Chromium で共有カード 21 枚とアイコン 2 枚を撮り、`favicon.svg` を書く。書体は `src/styles/og.css` の `'Noto Sans CJK JP', 'Hiragino Sans', sans-serif` を端末から探すため、実行環境によって字形が変わる。AGENTS.md は「コミット済みの画像は別のマシンで作ったもの」「Noto Sans CJK JP と Hiragino Sans と見ている」とし、どちらが正本か確定していなかった。一方、ADR 0014 は配色更新で macOS の既存フォントと Playwright Chromium を生成環境として採用し、PNG を同期したと記録している。

## 調査（2026-09-16）

`public/og/` を上書きせず、一時ディレクトリへ全ファイルを生成して、コミット済み（`fdd6d41` 以降変更なし）と比べた。

| 条件 | 値 |
|---|---|
| OS | macOS 15.8（24H22）、Apple Silicon |
| Node.js | 24.21.0 |
| Playwright | 1.63.0（`chromium-headless-shell` revision 1243、Chromium 153.0.8010.12） |
| 実際に使われた書体 | Chrome DevTools Protocol の `CSS.getPlatformFontsForNode` で確認。屋号・見出し・約束のラベルは Hiragino Sans W6、金額は W8、「円〜」は W5。Noto Sans CJK JP はこの Mac に入っておらず使われていない |
| 結果 | **24 ファイル（PNG 23・SVG 1）すべてバイト一致** |

作業環境のサンドボックスでは TCP の待ち受けと Chromium の既定の起動が禁止されていたため、`og.ts` 自体は変更せず、作業用の使い捨てラッパー（Git 管理外）で、ローカル HTTP サーバーを同じ応答を返すプロセス内の処理に、Chromium の起動引数を `--no-sandbox --single-process --no-zygote` に差し替えて実行した。それでも全ファイルが一致したため、コミット済みの画像はこの条件（macOS 標準のヒラギノ角ゴシック）で作られたものと判断する。AGENTS.md の「Noto Sans CJK JP と見ている」は、この Mac では当てはまらない。

## 決定

- **正本の生成環境**：macOS（15.8 で確認）＋ macOS 標準のヒラギノ角ゴシック ＋ `package-lock.json` で固定した Playwright（1.63.0）の Chromium。`og.css` の書体指定と既存の PNG は変えない。
- **正本の画像**：`main` にマージ済みの `public/og/` を承認済みの基準とする。
- **再現性の検査**：`npm run og:check` を追加する。一時ディレクトリに生成して `public/og/` とファイル単位のバイト列で比べ、生成物は消す（`--keep` で残す、`--generated <dir>` で比較だけ）。**`public/og/` は書き換えない。** 実行環境（OS・macOS の版・Playwright・Chromium）を正本の条件と並べて表示し、違いがあれば差分の原因の候補として示す。一致で終了コード 0、差分で 1、生成の失敗で 2。
- **CI の必須検査にはしない。** GitHub の Linux の Runner にはヒラギノ角ゴシックがなく、常に不一致になるため。
- 実行する時期：共有カードの文面・`og.css`・トークンを変えたとき、Playwright を更新したとき（Dependabot）、macOS を更新したとき。差分が出たら画像を目で確かめ、承認を得てから `npm run og` で更新する。
- 書体ファイルはダウンロードしない。

## 別 OS で再現するための書体の選択肢（比較）

いまの字形を保つ限り、再現できるのは macOS だけになる。別 OS（CI の Linux など）で同じ画像を作るには、書体ファイルそのものをリポジトリか生成環境に置く必要がある。ライセンスは採用時に各書体の配布元の本文で確認する。

| 案 | 書体 | ライセンス | 配置方法 | 字形の変化 | 備考 |
|---|---|---|---|---|---|
| A（現状） | ヒラギノ角ゴシック | macOS に付属する書体。macOS の使用許諾の範囲で macOS 上で使い、ファイルをほかの環境へ複製・同梱しない | 不要（macOS の標準） | なし | macOS 以外で再現できない。CI では検査できない |
| B | Noto Sans CJK JP | SIL Open Font License 1.1 | 必要なウェイトのファイルを `src/assets/fonts/` などに置き、`og.css` の `@font-face` から画像生成時だけ読む（公開ページには配らない）。または生成用コンテナに OS のパッケージで入れる | 全カードの字形が変わる | `og.css` の第一候補と同じ名前。ファイルが大きく、サブセット化の可否と名前の扱いはライセンス本文で確認 |
| C | 源ノ角ゴシック（Source Han Sans） | SIL Open Font License 1.1 | B と同じ | 全カードの字形が変わる | B と同じ設計で名前が異なる |
| D | BIZ UDPゴシック | SIL Open Font License 1.1 | B と同じ | 全カードの字形が変わる | 読みやすさを重視した設計。字幅の印象が変わる |
| E | IBM Plex Sans JP | SIL Open Font License 1.1 | B と同じ | 全カードの字形が変わる | 欧文との調和を重視した設計 |

B〜E のどれでも、書体ファイルを同梱しただけでは OS をまたいだバイト一致にはならない（文字の描画処理が OS ごとに異なる）。別 OS で検査するなら、書体の同梱に加えて、生成と検査を同じコンテナ（例：Playwright の公式イメージを版で固定したもの）で行い、その環境で撮った画像を新しい正本として承認し直す。

## オーナーの判断に残すもの

1. A を続けるか、B〜E に切り替えるか。切り替える場合は全 21 枚のカードとアイコンの字形が変わるため、画像の承認が要る
2. 切り替える場合の生成環境（macOS のままか、固定したコンテナか）と、CI で `og:check` を必須にするか
3. 書体ファイルをリポジトリに同梱する場合の容量とライセンス表示の置き場所

承認までは既存の字形を一括で置き換えない。
