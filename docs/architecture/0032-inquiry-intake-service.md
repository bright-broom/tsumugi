# 0032 — 問い合わせの受付を、静的サイトから分離した Web 標準のハンドラにする

日付：2026-09-16。状態：採用（配備先と本番の保存先は未決。[0035](0035-inquiry-hosting-candidates.md)）。関連：[#10](https://github.com/bright-broom/tsumugi/issues/10)、[#11](https://github.com/bright-broom/tsumugi/issues/11)、[#33](https://github.com/bright-broom/tsumugi/issues/33)。

## 背景

`contact.html` のフォームは `FORM_ENDPOINT` が空のため送信ボタンが無効で、受け口・保存・送信結果の実装がなかった。公開ページ（`out/`）は実行時 JavaScript 0 バイトが売りで、受付処理をページに持ち込めない。リポジトリ直下に `api/` を置くと Vercel が関数として自動で配備するため、配備を伴わずに実装する置き場所も決める必要があった。

## 決定

### 置き場所と依存

- 受付処理は `services/inquiry/` に置く。Next.js のページ・ビルド・`out/` とは独立し、リポジトリ直下の `api/` は作らない。
- `services/` は `@/content`・`@/i18n`・`@/routing`・`@/lib` だけを使い、`services/` の外へ相対パスで出ない。`src/` と `tools/` は `services/` を import しない。`tools/scripts/check-structure.ts` がこの向きと JavaScript ファイルの混入を検査する。
- `tsconfig.json`・`config/knip.config.ts` の対象に加え、利用者に見せる文言がカタログから来ることを `check-content` でも検査する。ESLint はリポジトリ全体が対象のまま。
- 結果画面の文言は `i18n/locales/ja/inquiry.ts`、フォームの項目名は `contact.ts` を再利用する。フォームの `name` 属性・上限・保持期限・担当者は `content/inquiry.ts`、営業日は `content/business-calendar.ts` に置き、公開ページと受付サービスが同じ値を使う。

### ハンドラの形

`createInquiryHandler(options)` は `(request: Request) => Promise<Response>` を返す。保存先・通知の開始・レート制限・時計・応答後の処理（`waitUntil`）は引数で受け取る。使うのは `Request`／`Response`／`ReadableStream`／Web Crypto／`TextEncoder` だけで、`node:fs` を使うのはローカル開発用の `file-store.ts` だけ。組み立ては `site.ts` の `createSiteInquiryService` にまとめ、配備先のエントリは保存先と送信アダプタを渡して呼ぶだけにする。

| 配備先 | エントリの例（このリポジトリには置かない） |
|---|---|
| Cloudflare Workers | `export default { fetch: (req, env, ctx) => createSiteInquiryService({ …, schedule: (t) => ctx.waitUntil(t) }).handler(req) }` と、Cron Trigger から `outbox.dispatchDue()` |
| Vercel Functions | 別プロジェクトの Web ハンドラ `export async function POST(request: Request) { return service.handler(request); }`。応答後の処理は `waitUntil` を渡し、Cron から `dispatchDue()` |
| 任意の Node サーバー | Node 24 の `Request` に変換して `handler` を呼ぶ。サーバーのフレームワークは配備時に選ぶ |

配備時は `i18n/catalog` が参照する parse5（開発依存）も含めて束ねる（esbuild など）か、依存の区分を見直す。いまは配備しないので依存は追加していない。

### フォーム

- `FORM_ENDPOINT` が空の間は、これまでどおり `action`・`method` を出さず送信ボタンを無効にする。**この状態の `out/` は変更前と全 50 ファイルの SHA-256 が一致する。**
- 値が入ったときだけ `action`・`method="post"` と、迷惑投稿対策の隠し項目（`<div hidden>` の中のラベル付き入力、`tabindex="-1"`・`autocomplete="off"`）を出す。`hidden` で表示・読み上げ・タブ移動から外すので CSS を追加せず、`verify` のラベル対応とタップ領域の検査にも引っかからない。`maxlength` などはサーバー側で強制し、公開ページの表示の変更を最小にした。
- 描画した問い合わせページのフォームから入力名を読み取って受付サービスへ送る結合テストを置き、ページとサービスの項目のずれを検出する。

### 検証・迷惑投稿・重複

- zod で検証する。必須はお名前・お電話番号・ご相談の内容（プライバシー表示と同じ3つ）。上限は文字数（コードポイント）で、お名前・会社名 100、電話 30、メール 254、内容 4,000。電話は区切りを除いて `0` から始まる 10〜11 桁か `+81`。メールは形式検査。業種は一覧の値だけ。本文は 64 KiB、形式は `application/x-www-form-urlencoded` だけを受け付ける。
- 利用者の入力は NFC（電話・メールは NFKC で半角化）と制御文字の除去だけを行い、表示用の和欧文スペース整形を通さない。
- 隠し項目に値があれば「迷惑投稿の疑い」として保存し、担当者に通知せず、返信期限も数えず、30 日で削除する。人の誤入力でも受付を失わないためで、応答は通常の成功画面と同じにする。
- レート制限は `RateLimiter` インターフェース。鍵は接続元をハッシュにした値で、IP アドレスそのものは保存しない。メモリ実装はインスタンス単位なので、本番は配備先の共有ストアかレート制限機能で実装する。
- `allowedOrigins` を指定すると、Origin ヘッダーが別サイトを示す送信を 403 にする（`Origin: null` は判定できないので通す）。応答は `Content-Security-Policy: default-src 'none'` でスクリプトを一切許可しない。
- 正規化した入力の SHA-256 を指紋にし、10 分以内の同じ内容は同じ受付番号に寄せる（二重送信・再読み込み対策）。判定と保存は保存先の `createOrGetRecent` が原子的に行う。
- 受付番号は `INQ-YYYYMMDD-XXXXXXXX`（日本時間の日付と、Web Crypto の乱数による Crockford Base32 の 8 文字）。

### 応答（JavaScript なし）

| 状態 | 画面 | 利用者が次にすること |
|---|---|---|
| 200 受付 | 受付番号・受付日時・返信の期限。重複なら「二重には受け付けていない」 | 待つ。期限を過ぎたら受付番号を添えて電話かメール |
| 422 入力エラー | 項目ごとの誤りの一覧と、入力を残した再送信フォーム（`aria-invalid`） | 直して送り直す |
| 503 受付障害 | 「保存できていない」と明示し、送ろうとした本文を表示。`Retry-After` | 時間をおいて再送するか、電話・メール |
| 429 送信過多 | 待つ時間の目安。`Retry-After` | 待つか、電話・メール |
| 403・405・413・415 | 形式を確認できなかった旨 | 相談ページから送り直す |

どの画面にも電話（`tel:`）とメール（`mailto:`）の代替導線を載せ、`Cache-Control: no-store`・`noindex`・`Referrer-Policy: no-referrer` を付ける。結果画面は受付サービスが返す動的な HTML で、**静的ページは 21 のまま増やさない**。OGP・sitemap・`verify` の件数は変わらない。見た目はサイトの `theme.css` と既存のクラスを参照するだけで、専用の CSS は足していない（配備時に画面を確認する）。

### 保存先

`InquiryStore`（`createOrGetRecent`・`get`・`update`・`list`・`delete`）をインターフェースにする。本番の実装は、重複判定付きの作成と、読み取りから書き込みまでの間に他の更新が入らない `update` を原子的に行う必要がある（`version` を持たせている）。

- `MemoryInquiryStore`：テストと単一プロセス用。
- `FileInquiryStore`：ローカル開発用。1 つの JSON を一時ファイル経由で置き換え、同じプロセス内の書き込みを直列にする。権限は所有者のみ（0600）。置き場所は Git 管理外にし、実データを入れない。

本番の保存先の候補と判断材料は [0035](0035-inquiry-hosting-candidates.md) に残し、オーナーが選ぶ。

## 検証

`tests/inquiry/` の結合テストで、描画したフォームからの正常受付（保存・受付番号・期限・2 系統通知）、片系障害でも受付が残ること、重複の寄せ、不正入力（エスケープ・入力保持・未保存）、隠し項目の隔離、保存障害（503・代替導線・通知なし）、送信過多、方式・形式・大きさ・Origin の拒否を、実ポートで待ち受けずに `handler(new Request(…))` で確認する。ブラウザ実測を含む `npm run verify` はこの作業環境では実行できなかった（ソケットの待ち受けと Chromium の起動が制限されている）。

## 今回の境界

実際の配備、送信アダプタ（メール・LINE・SMS）の実装、担当者の管理画面、結果画面の見た目の確認、本番向け公開条件の検査（#13）との統合はこの決定に含めない。
