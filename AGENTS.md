# AGENTS.md ── 開発を引き継ぐ人と AI へ

会話の履歴がなくても開発を続けられるようにするための入口。
Codex・Cursor・GitHub Copilot などはこのファイルを、Claude Code は `CLAUDE.md` 経由で同じ内容を読む。
`site/` の中では、Next.js が生成した `site/AGENTS.md`（このバージョンの Next.js についての注意）にも従う。

---

## 1. これは何か

- 小規模事業者向けホームページ制作「紬（つむぎ）」の自社サービスサイト。21ページ
- 同じコードベースを、顧客に納品するサイトのテンプレートとして使い回す前提（2件目以降は中身を差し替えて作る）
- **「実行時 JavaScript 0バイト」がサイトの売り文句そのもの。** 技術選定の理由もここにある
- 本体は `site/`（Next.js 16 Pages Router + React 19 + TypeScript）。静的HTMLに書き出し、どのホスティングにも置ける

## 2. 読む順番

| 順 | 文書 | 分かること |
|---|---|---|
| 1 | このファイル | 崩してはいけないこと・合格ライン・進め方・はまりどころ |
| 2 | [docs/status.md](docs/status.md) | **いまの状態と残課題。作業の前に必ず確認する** |
| 3 | [site/README.md](site/README.md) | コマンド・書き方の決まり・置き場所の決まり |
| 4 | [docs/README.md](docs/README.md) | 仕様・判断理由・事業の文書の目次 |
| 5 | [docs/spec.md](docs/spec.md) | 納品の条件（検査項目） |
| 6 | [docs/architecture/README.md](docs/architecture/README.md) | 技術判断の一覧と ADR |
| 必要なとき | [docs/business/紬_ビジネスガイドライン.md](docs/business/紬_ビジネスガイドライン.md) | 事業の規範（何を売り、何を約束しないか）。サイトの文言を変えるときは必ず読む |

## 3. 崩してはいけないこと

| 決まり | 理由 | 何が守っているか |
|---|---|---|
| 納品物（`site/out/`）に実行時 JS を載せない。`<script>` は JSON-LD だけ | spec・owned・works ページに書いた主張の根拠 | `site/scripts/postbuild.ts` がビルドを落とす／`verify`「実行時JSなし」 |
| 全ページに `export const config = { unstable_runtimeJS: false }` を置く | Pages Router で JS を出さない方法はこれだけ | 同上 |
| App Router に移さない | 静的書き出しでも全ページに約173KB（gzip）の JS が載る | [ADR 0001](docs/architecture/0001-pages-router.md) |
| `verify` に FAIL が1件でもあれば納品しない | 仕様の正本は検査コード（`site/verify/`） | `npm run verify` の終了コード |
| 金額は `site/src/content/prices.ts` からだけ引く。`RUN` や `BUILD` を添字で引かない | 添字で引いていて、プランを足したときに全ページの月額が静かに下振れした事故がある。`docs/business/紬_事業の中身.xlsx` は写しで、Excel を直してもサイトは変わらない | `verify`「29 価格の一致」 |
| 依存は `pages → application → views → layouts → components → content → i18n → routing → lib` の一方向。`src/` の中は `@/` で import する | 文言・事業データ・ルート・表示の責務を分ける | `npm run check`（[ADR 0004](docs/architecture/0004-content-and-routing.md)） |
| 測っていない数字をページに書かない | 事業の規範 | `works.html` の件数は `verify-report.json` から読む |
| 他社名をサイトに書かない。負けている比較の行も消さない | 事業の規範 | [docs/product/messaging-and-pricing.md](docs/product/messaging-and-pricing.md) |

## 4. コマンドと合格ライン

```bash
cd site
nvm install && nvm use
npm install --global npm@12.0.2
npm ci
PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium   # 初回だけ（verify と og が使う）
npm run dev       # http://localhost:3000
npm run check     # 型検査 ＋ 依存の向きの検査
npm run build     # トークン同期の検査 → public/ の生成 → next build → postbuild → out/
npm run verify    # 全項目の検査（ブラウザ計測を含む）
```

**変更を出す前に、次の全部を満たす。**

1. `npm run check`・`npm run lint`・`npm test` が通る
2. `npm run build` が通る（postbuild が「実行時の script 0件・区切りコメント 0件」を出す）
3. `npm run verify` が **PASS 608 / WARN 1 / FAIL 0**（WARN 1 は `PLACEHOLDER=true` による既知の1件）
   - 検査項目やページを増減すると 608 は変わる。そのときは `docs/spec.md` と `docs/status.md` の数字も直す
4. 見た目を変えないはずの変更（リファクタリング）では、`site/out/` の全ファイルのハッシュが変更前と同じ。HTML/CSSの生成方式自体を変更する場合は、変更対象以外のハッシュ一致と、同じブラウザでのPC・モバイルの画面比較で確かめ、差分の理由をADRに記録する（[ADR 0009](docs/architecture/0009-global-tailwind.md)）

## 5. 進め方

- **ブランチを切り、プルリクエストで `main` に入れる。** これまでの変更はすべてこの形で入れている
- **コミットの作者メールは GitHub の noreply アドレスにする**（このリポジトリの `git config user.email` に設定済み）。
  GitHub のメール保護が有効で、個人のアドレスが入ったコミットを含む push は拒否される
- **push の前に、送るコミットのメールを確かめる：** `git log --format='%h %ae %ce %s' origin/main..HEAD`
- `git push … | tail` のようにパイプでつなぐと、失敗が握りつぶされて次のコマンドが走る。つなぐなら `set -o pipefail`
- リポジトリは **private のまま**にする。`docs/business/` に社内の数字がある
- 判断を下したら `docs/architecture/` に ADR を足す。**作業を終えたら `docs/status.md` を更新する**
- 文書の置き場所は [docs/README.md](docs/README.md)「文書の置き場所の決まり」に従う

## 6. はまりどころ（実際に踏んだもの）

| 症状 | 原因 | 対処 |
|---|---|---|
| postbuild が「区切りコメント」で落ちる | JSX で `ほか{n}項目` と書くと、React が `ほか<!-- -->5<!-- -->項目` を出す | 値を混ぜる文字列はテンプレートリテラルで1つにする |
| `verify` の「構造化データ」「title の長さ」が全ページで落ちる | Next.js が head の要素に `data-next-head=""` を付ける | postbuild が消している。postbuild を通していない出力を検査しない |
| 同じ入力なのにビルドのたびに HTML が変わる | 図の marker id を通し番号にしていた（ページは並列に書き出される） | id は `content/diagrams.ts` が aria-label から決める。出力をモジュール内の可変な状態に依存させない |
| `works.html` の検査件数が古い、または「—」 | 件数はビルド時点の `site/verify-report.json`（git 管理外）を読む | `npm run build && npm run verify && npm run build` |
| `npm run og` を実行すると全 PNG が差分になる | コミット済みの画像は別のマシンで作ったもの。この Mac では日本語の書体が変わる（Noto Sans CJK JP と Hiragino Sans と見ている） | 字形の正本を決めるまで再生成しない（[docs/status.md](docs/status.md)） |
| `node:fs` を使ったページでビルドが落ちる | ページのモジュールはクライアント用の束にも含まれる | `getStaticProps` の中だけで使う |
| `npm run dev` の HTML に script がある | 開発サーバーはホットリロード用の JS を入れる | 0バイトの対象は `out/`。開発中の HTML で判断しない |
| `next dev` のたびに `site/AGENTS.md`・`site/CLAUDE.md` が現れる | Next.js 16 が生成・再生成する | 動かさずにコミットしておく |
| TypeScript 7 で ESLint が動かない | typescript-eslint は TypeScript 6 の JavaScript API が必要 | `@typescript/native` の `tsc` は 7.0.2、`typescript` は公式互換パッケージの 6.0.3。併用を保つ（ADR 0003） |
| 検査で「ブラウザが無い」と言われる | Playwright のブラウザは Playwright の版ごとに入れる | `PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium` |

## 7. いまの状態と残課題

[docs/status.md](docs/status.md) を見る。ここには書かない（同じことを2か所に持つと、片方が古くなる）。
