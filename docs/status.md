# 現状と残課題

- 最終更新：2026-09-14（和モダンの共通ヘッダー）
- **作業を終えたら、この文書を更新する。** 終わった課題は消さずに「完了した課題」へ移し、日付を入れる
- 事業として決めること（運用の工数・集客経路・出張撮影の扱いなど）の順番は、[ビジネスガイドライン](business/紬_ビジネスガイドライン.md) の「12. 未決事項」が正本。法令まわりの未解決は同じ文書の「8.1」。ここには、**コードと公開作業に関わるもの**を書く

> 文中のコードのパス（`src/…` `scripts/…` `verify/` `styles/` `public/` `out/`）は `site/` からの相対。

---

## 現状

### サイトとコード

| | 状態 |
|---|---|
| 構成 | `site/`：Next.js 16.3.5（Pages Router）・React 19.3.0・TypeScript 7.0.2（検査ツール用 API は公式互換パッケージ 6.0.3）。21ページを `out/` に静的書き出し |
| 実行時 JS | 全21ページで 0（`postbuild` と `verify` で確認） |
| 検査 | `npm run verify`：**PASS 592 / WARN 1 / FAIL 0**。WARN は `PLACEHOLDER=true` による1件。`npm run verify -- --static`：PASS 360 / WARN 1 / FAIL 0 |
| 型・依存・文言 | `npm run check` が通る。ESLint エラー・警告 0、Vitest 112 件合格 |
| 依存の健全性 | npm 12 のクリーンな `npm ci` 成功、`npm audit` 0 件。CLI の依存には修正版 override を指定。Dependabot は ESLint と Node 型定義のメジャー更新だけを除外し、既存の互換性方針を維持（ADR 0003） |
| 動作を確かめた環境 | macOS・Node 24.21.0・npm 12.0.2・Playwright 1.63.0（Chromium）。ローカル・CI・Vercel を Node 24 系へ統一 |
| 文言とルート | `i18n/locales/ja/` と `routing/registry.ts` に集約。Next の入口3枚と表示テンプレートを分離。電話は共通部品でアイコン＋番号だけを表示（ADR 0004） |
| 共通ヘッダー | 生成り・藍墨・明朝の屋号。高さ88/72px、問い合わせCTAとネイティブの全体メニュー。追加の実行時JS・外部フォントなし（ADR 0006） |
| 暫定ヒーロー | ヘッダー直下に国生みの画像を配置。自己完結SVG（WebP内包、約741 KiB）、モバイルの補助コピーと読み上げに対応（ADR 0005） |
| 旧版 | Python 版（`svc/`）と Astro 版（`svc-astro/`）は削除済み。コミット `01f39d4` で読める。移植が正しいことの確かめ方は [history/2026-09-migration.md](history/2026-09-migration.md) |

### 中身（公開前の仮の状態）

| `src/content/config.ts` の設定 | いまの値 | 影響 |
|---|---|---|
| `PLACEHOLDER` | `true` | 全ページの上部に「準備中」の帯が出る。`terms.html` に「弁護士確認前」の注意書きが出る |
| `DOMAIN` / `TEL` / `EMAIL` / 住所 | `example.jp` / `000-0000-0000` / `info@example.jp` / 仮の値 | canonical・OGP・JSON-LD がすべて仮のドメインを指す |
| `FORM_ENDPOINT` | 空 | 問い合わせフォームが送信できない |
| `LINE_URL` | 空 | LINE の導線は出ない |
| `RESPONSE_ACTUAL` | `null` | 返答時間の実績は出さない（まだ測っていない） |
| 制作事例 | 0件 | `works.html` は「これから積みます」 |

### リポジトリ

| | 状態 |
|---|---|
| GitHub | `bright-broom/tsumugi`・**private**・既定ブランチ `main` |
| マージ済み | #1 Next.js への集約、#2 `src/` の層分けと `docs/` の整理 |
| 残っているブランチ | マージ済みの `feat/nextjs-migration` と `refactor/directory-structure` がリモートに残っている |
| CI | GitHub Actions に型・lint・単体テスト・ビルド・静的検査・Chromium 実測を追加。実行結果は PR のチェックを参照 |
| デプロイ | Vercel `koenigwolfs-projects/tsumugi` と GitHub を接続。Root Directory=`site`、Framework=Other、output=`out`、Node 24。認証付きプレビューで全21ページ HTTP 200、実行時 JS 0、未知の URL は 404 を確認。本番の独自ドメインは未設定 |

---

## 残課題

### A. 公開を止めているもの

| 課題 | やること | 手がかり |
|---|---|---|
| 事業者情報・連絡先を実際の値にする | `config.ts` の `AREA` `DOMAIN` `TEL` `EMAIL`・住所と `i18n/locales/ja/config.ts` の2人のプロフィールを差し替え、`PLACEHOLDER = false` にする。**false にすると `verify` が仮の値の残りを FAIL にする** | [operations.md「公開前にやること」](operations.md) |
| 問い合わせフォームの送信先 | `FORM_ENDPOINT` を設定する。**同時に、通知をメールと LINE（または SMS）の2系統に分ける**（問い合わせに気づかないことが最大の失注要因） | 受け口は社内ツールとして作る予定（ガイドライン「10.5」） |
| `terms.html` の弁護士確認 | 下書きの文面を確認してもらって確定する。フリーランス法第4条（書面交付義務）への対応も同時に。**確認が済むまで、分割払いを商談に出さない** | `src/i18n/locales/ja/terms.ts`、ガイドライン「8.1」 |
| `legal.html` の事業者情報 | 販売事業者名・運営責任者・所在地が仮の値。開業届／登記のあとに差し替える | `config.ts` |
| 屋号の確認 | 商標（J-PlatPat 第42類・第35類）・同名法人（法人番号公表サイト）・ドメイン | [messaging-and-pricing.md「屋号」](product/messaging-and-pricing.md) |
| 本番公開と独自ドメイン | Vercel へのプレビュー配備は実施。本番の事業者情報を確定し、独自ドメインを設定して公開する。`◯◯.vercel.app` のまま納品しない | [operations.md「Vercel に載せるとき」](operations.md) |

### B. 公開のあとに

| 課題 | やること | 手がかり |
|---|---|---|
| LCP の実データ | サイトに載せている LCP は `measurements.ts` の数値から組み立てた `LCP_MEASURED`（手元の計測）。公開後に Search Console の実データで確かめる | `npm run verify -- --write` |
| 制作事例 | 1号案件の実測値（LCP・Google ビジネスプロフィールの閲覧数・問い合わせ件数）を `works.html` に入れる | `src/views/works.tsx` |
| 返答時間の実績 | 計測を始めてから `RESPONSE_ACTUAL` に書く（測っていない数字は書かない） | `config.ts` |

### C. 開発の基盤

| 課題 | やること | 手がかり |
|---|---|---|
| ヒーロー画像の本採用 | 暫定SVG内の絵と描き込み文字を分離し、表示コピーをすべてカタログから生成する。現段階で文言を変える場合は元絵も同時に更新する | [ADR 0005](architecture/0005-temporary-hero.md)、`assets/hero/README.md` |
| OGP画像の字形の正本 | コミット済みの PNG 23枚は別のマシンで作ったもの。この Mac で `npm run og` を実行すると、日本語の書体の違いで全PNGが差分になる（ファビコンの SVG は一致）。どの環境の字形を正本にするか決め、その環境で作ってコミットする | `scripts/og.ts`、[design.md「共有カード」](product/design.md) |
| マージ済みブランチの削除 | リモートの `feat/nextjs-migration`・`refactor/directory-structure` を消す | `git push origin --delete <ブランチ名>` |
| Next.js を上げるときの確認 | `unstable_runtimeJS` は将来の版で変わりうる。上げたら合格ラインを全部通す | [ADR 0001](architecture/0001-pages-router.md) |
| 共通部分のパッケージ分割 | **顧客サイトが2件目になったときに**、`content/` を境に切り出す。それまではやらない | [ADR 0002](architecture/0002-directory-layers.md) |
| 原書体の契約 | 欧文ディスプレイは無料代替の League Gothic（原サイトは Manuka Condensed）。契約して差し替えるなら `--nah-ratio-display-correction` を 1 に戻して再計測する | `styles/` |
| 競合調査メモ | 文書が参照している `claude/competitor-propagate.md` が、このリポジトリにない | 必要なら `docs/business/` に入れる |
| 書き換え前のコミット | 2026-09-14 に、コミットの作者欄のメールアドレスが一時的に公開された。履歴は書き換え済みで、リポジトリは private にした。書き換え前のコミット（`cfb3616` `ddb0f82` `21437ee`）は、GitHub 上で SHA を指定すると見られる可能性が残る | 完全に消すなら GitHub Support に依頼する |

---

## 完了した課題

| 日付 | 内容 |
|---|---|
| 2026-09-14 | Python 版・Astro 版を Next.js（Pages Router）に集約し、検査・OGP画像の生成・トークンの生成を TypeScript に移した（#1） |
| 2026-09-14 | `verify --static` の結果を別ファイルに分け、簡易版を回しても `works.html` の件数が下がらないようにした（#1） |
| 2026-09-14 | `src/` を層に分け、ドキュメントを `docs/` に整理した（#2） |
| 2026-09-14 | 引き継ぎの入口（`AGENTS.md`）とこの文書を作り、ガイドライン「10. 道具と環境」を今の構成に合わせた |
| 2026-09-14 | TypeScript 7、Node 24／npm 12、Lucide React・clsx・Zod・Vitest・ESLint・Prettier・最新 Playwright を導入。GitHub Actions、Dependabot、Vercel の静的配備設定を追加。実行時 JavaScript 0 バイトを維持（ADR 0003） |
| 2026-09-14 | 文言・ブランド呼称・OGP・ルートの中央管理と電話表示の統一（ADR 0004）。型・lint・単体112件・静的359 PASS・全項目577 PASS／WARN 1／FAIL 0を確認。電話補助ラベルの削除でコントラスト対象が111件から107件に減ったため合計を更新 |
| 2026-09-14 | Dependabot PR #6 の ESLint 10 による lint 停止を再現し、ESLint 9.39.5・Node 型定義24.13.4へ復旧。両依存のメジャー更新を除外して再発を防止（ADR 0003）。クリーンインストール・型・lint・単体112件・静的359 PASS・全項目577 PASS／WARN 1／FAIL 0を確認 |
| 2026-09-14 | 利用者指定の国生みの画像を SVG に内包し、ホームのヘッダー直下へ暫定配置。PC・390px・320pxで全景表示と横はみ出しなしを確認。型・lint・単体112件・静的360 PASS・全項目580 PASS／WARN 1／FAIL 0、実行時JS 0バイトを維持（ADR 0005） |
| 2026-09-14 | 共通ヘッダーを和モダンに刷新し、`Header.tsx` に分離。幅320〜1440px、JS無効でのメニュー開閉・遷移・現在地を確認。型・lint・単体112件・静的360 PASS・全項目592 PASS／WARN 1／FAIL 0（ADR 0006）。ヘッダーのコントラスト検査対象が12件増加 |
