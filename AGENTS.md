# AGENTS.md ── 開発を引き継ぐ人と AI へ

会話の履歴がなくても開発を続けられるようにするための入口。
Codex・Cursor・GitHub Copilot などはこのファイルを、Claude Code は `CLAUDE.md` 経由で同じ内容を読む。
Next.js が生成した、この文書末尾のルール（このバージョンの Next.js についての注意）にも従う。

---

## 1. これは何か

- 小規模事業者向けホームページ制作「紬（つむぎ）」の自社サービスサイト。21ページ
- 同じコードベースを、顧客に納品するサイトのテンプレートとして使い回す前提（2件目以降は中身を差し替えて作る）
- **「実行時 JavaScript 0バイト」がサイトの売り文句そのもの。** 技術選定の理由もここにある
- アプリのコードは `src/`（Next.js 16 Pages Router + React 19 + TypeScript）。静的HTMLに書き出し、どのホスティングにも置ける

## 2. 読む順番

| 順 | 文書 | 分かること |
|---|---|---|
| 1 | このファイル | 崩してはいけないこと・合格ライン・進め方・はまりどころ |
| 2 | [docs/status.md](docs/status.md) | **いまの状態と残課題。作業の前に必ず確認する** |
| 3 | [docs/development.md](docs/development.md) | コマンド・書き方の決まり・置き場所の決まり |
| 4 | [docs/README.md](docs/README.md) | 仕様・判断理由・事業の文書の目次 |
| 5 | [docs/spec.md](docs/spec.md) | 納品の条件（検査項目） |
| 6 | [docs/architecture/README.md](docs/architecture/README.md) | 技術判断の一覧と ADR |
| 必要なとき | [docs/business/紬_ビジネスガイドライン.md](docs/business/紬_ビジネスガイドライン.md) | 事業の規範（何を売り、何を約束しないか）。サイトの文言を変えるときは必ず読む |

## 3. 崩してはいけないこと

| 決まり | 理由 | 何が守っているか |
|---|---|---|
| 納品物（`out/`）に実行時 JS を載せない。`<script>` は JSON-LD だけ | spec・owned・works ページに書いた主張の根拠 | `tools/scripts/postbuild.ts` がビルドを落とす／`verify`「実行時JSなし」 |
| 全ページに `export const config = { unstable_runtimeJS: false }` を置く | Pages Router で JS を出さない方法はこれだけ | 同上 |
| App Router に移さない | 静的書き出しでも全ページに約173KB（gzip）の JS が載る | [ADR 0001](docs/architecture/0001-pages-router.md) |
| `verify` に FAIL が1件でもあれば納品しない | 仕様の正本は検査コード（`tools/verify/`） | `npm run verify` の終了コード |
| 本番の公開は `verify --mode production` の FAIL 0 が条件。仮の値・未接続の受付を公開しない。専門家・受入確認は原則必須。紬の自社公開のみ、明示されたオーナー判断の範囲で未確認を WARN に残す（[ADR 0056](docs/architecture/0056-owner-authorized-publication.md)） | 確認用のプレビューと本番を分ける | Vercel の本番配備では自動で本番モード（[ADR 0024](docs/architecture/0024-publication-gates.md)） |
| 金額は `src/content/prices.ts` からだけ引く。`RUN` や `BUILD` を添字で引かない | 添字で引いていて、プランを足したときに全ページの月額が静かに下振れした事故がある。`docs/business/紬_事業の中身.xlsx` は写しで、Excel を直してもサイトは変わらない | `verify`「29 価格の一致」 |
| 依存は `pages → application → views → layouts → components → content → i18n → routing → lib` の一方向。`src/` の中は `@/` で import する | 文言・事業データ・ルート・表示の責務を分ける | `npm run check`（[ADR 0004](docs/architecture/0004-content-and-routing.md)） |
| 測っていない数字をページに書かない。検査していない項目を「自動検査済み」と書かない | 事業の規範 | `works.html` の件数は同じコミット・全項目・FAIL 0 の `verify-report.json` からだけ読み、LCP には記録日を添える（[ADR 0025](docs/architecture/0025-verified-build-report.md)）。仕様20項目の確認の方法は対応表の検査が止める（[ADR 0026](docs/architecture/0026-acceptance-mapping.md)） |
| 他社名をサイトに書かない。負けている比較の行も消さない | 事業の規範 | [docs/product/messaging-and-pricing.md](docs/product/messaging-and-pricing.md) |

## 4. コマンドと合格ライン

```bash
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
3. `npm run verify -- --mode production` が **PASS 581 / WARN 3 / FAIL 0**（対象なし 40 件。WARN は自社公開で記録した専門家・受入確認の未実施。ADR 0056）
   - 検査項目やページを増減すると 581 は変わる。そのときは `docs/spec.md` と `docs/status.md` の数字も直す
4. 見た目を変えないはずの変更（リファクタリング）では、`out/` の全ファイルのハッシュが変更前と同じ。HTML/CSSの生成方式自体を変更する場合は、変更対象以外のハッシュ一致と、同じブラウザでのPC・モバイルの画面比較で確かめ、差分の理由をADRに記録する（[ADR 0009](docs/architecture/0009-global-tailwind.md)）

## 5. 進め方

- **ブランチを切り、プルリクエストで `main` に入れる。** これまでの変更はすべてこの形で入れている
- **コミットの作者メールは GitHub の noreply アドレスにする**（このリポジトリの `git config user.email` に設定済み）。
  GitHub のメール保護が有効で、個人のアドレスが入ったコミットを含む push は拒否される
- **push の前に、送るコミットのメールを確かめる：** `git log --format='%h %ae %ce %s' origin/main..HEAD`
- `git push … | tail` のようにパイプでつなぐと、失敗が握りつぶされて次のコマンドが走る。つなぐなら `set -o pipefail`
- リポジトリは **Publicのまま**にする。2026-09-14にユーザーが `docs/business/` の社内資料を含めたpushを明示的に承認した。作者メールは引き続きnoreplyを使い、認証情報は含めない。
- 判断を下したら `docs/architecture/` に ADR を足す。**作業を終えたら `docs/status.md` を更新する**
- 文書の置き場所は [docs/README.md](docs/README.md)「文書の置き場所の決まり」に従う

## 6. はまりどころ（実際に踏んだもの）

| 症状 | 原因 | 対処 |
|---|---|---|
| postbuild が「区切りコメント」で落ちる | JSX で `ほか{n}項目` と書くと、React が `ほか<!-- -->5<!-- -->項目` を出す | 値を混ぜる文字列はテンプレートリテラルで1つにする |
| `verify` の「構造化データ」「title の長さ」が全ページで落ちる | Next.js が head の要素に `data-next-head=""` を付ける | postbuild が消している。postbuild を通していない出力を検査しない |
| 同じ入力なのにビルドのたびに HTML が変わる | 図の marker id を通し番号にしていた（ページは並列に書き出される） | 現行は `components/Figure.tsx` が SVG ごとの React `useId` で生成し Context で渡す（ADR 0023）。出力をモジュール内の可変な状態に依存させない |
| `works.html` の検査件数が「—」 | 件数は、ビルドと同じコミット・未コミットの変更なし・全項目・FAIL 0 の `.artifacts/verification/verify-report.json`（git 管理外）だけを使う | 変更をコミットしてから `npm run build && npm run verify && npm run build` |
| `npm run og` を実行すると全 PNG が差分になる | 字形は端末の書体で決まる。コミット済みの画像は macOS 標準のヒラギノ角ゴシック＋固定した Playwright の Chromium で再現でき、ほかの OS や Noto Sans CJK JP を入れた端末では変わる | 先に `npm run og:check`（`public/og/` を書き換えない）で一致を確かめる。書体の切り替えは未決（[ADR 0047](docs/architecture/0047-og-image-environment.md)） |
| `node:fs` を使ったページでビルドが落ちる | ページのモジュールはクライアント用の束にも含まれる | `getStaticProps` の中だけで使う |
| `npm run dev` の HTML に script がある | 開発サーバーはホットリロード用の JS を入れる | 0バイトの対象は `out/`。開発中の HTML で判断しない |
| `next dev` のたびに `AGENTS.md`・`CLAUDE.md` にルールが加わる | Next.js 16 が生成・再生成する | 動かさずにコミットしておく |
| TypeScript 7 で ESLint が動かない | typescript-eslint は TypeScript 6 の JavaScript API が必要 | `@typescript/native` の `tsc` は 7.0.2、`typescript` は公式互換パッケージの 6.0.3。併用を保つ（ADR 0003） |
| 検査で「ブラウザが無い」と言われる | Playwright のブラウザは Playwright の版ごとに入れる | `PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium` |

## 7. いまの状態と残課題

[docs/status.md](docs/status.md) を見る。ここには書かない（同じことを2か所に持つと、片方が古くなる）。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
