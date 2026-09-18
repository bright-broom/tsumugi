# 0079 問い合わせ受付を Cloudflare Workers ＋ D1 に配備できるようにする

- 日付：2026-09-19
- 状態：採用（配備・実送信は未実施。main 反映は status.md 参照）

## 背景

監査 C04〜C06。受付・二重通知・再送・権限・監査・保持期限の本体は `services/inquiry/` にあるが、保存先・送信回数制限・操作履歴はメモリかローカルファイル、送信アダプタはなく、担当者のログインも権限関数に ID を渡すだけで、本番に置けなかった。[ADR 0035](0035-inquiry-hosting-candidates.md) は Cloudflare Workers ＋ D1 を暫定の第一候補としていた。2026-09-19、オーナーは受付準備中の商品（顧客サイトのフォーム受付を含む）も実装するよう指示した。

## 判断

ADR 0035 の第一候補で実装する。業務の本体（handler・outbox・access・retention）は変えず、次の部品と入口を足す。

- `d1.ts`：D1 の保存先。重複の寄せは 1 文の `INSERT ... WHERE NOT EXISTS`、更新は version を比べる条件付き `UPDATE` で、競合したら読み直す（5回で失敗）。操作履歴は追記専用のテーブル。送信回数は 1 文の `UPSERT ... RETURNING` で数え、複数インスタンスで共有する。スキーマは `migrations/0001_init.sql`。
- `channels.ts`：LINE Messaging API の push（重複防止の鍵から作る UUID を `X-Line-Retry-Key` に付け、409 は配信済み）と、Cloudflare Email Routing の送信（確認済みの宛先だけに届く方式。UTF-8 の MIME を組み立て、同じ通知は同じ Message-ID）。認証・宛先の誤りは再試行しない失敗、429・5xx・通信障害は再試行。
- `auth.ts`：Cloudflare Access の JWT を、チームの公開鍵で署名・発行元・AUD・期限まで検証し、メールアドレスを担当者 ID に対応付ける。対応表は Secret に置く。
- `admin.ts`：担当者画面。JavaScript なしのリンクとフォームだけで、操作はすべて既存の窓口（権限判定と履歴）を通す。変更の POST は同じ origin からだけ受ける。削除・保持期限の実行は確認のチェックを必須にする。
- `app.ts`・`worker.ts`：入口。`/inquiry`・`/status`・`/admin` と、5分ごとの定期実行（期限の来た通知の送信と再送、失敗・遅延の記録、送信回数の古い記録の削除）。Workers 固有の `cloudflare:email` は `worker.ts` だけに閉じ込め、ほかはテストで動かす。
- 送信回数の上限は接続元ごとに10分で5件（`INQUIRY_RATE_LIMIT`）。

型パッケージや wrangler を依存に加えない（配備時に `npx wrangler` を使う）。`/status` は区分ごとの件数だけを返し、受付番号・内容を返さない。

## 限界と未決

- 無料枠・超過時の挙動・商用利用の規約は未確認（ADR 0035 の条件のまま）。顧客の受付開始前にオーナーが確認し、ここへ確認日を追記する。
- 実配備・実送信・実際の Access 設定では試していない。テストは Node 内蔵の SQLite（本物の SQL の一意制約・条件付き更新）、模擬の LINE と Access（実際の RSA 署名）で行った。
- 両系統とも通知に失敗した場合は担当者に届かないため、`/status` の外部監視が必要。保持期限の削除は自動では行わず、担当者が確認して実行する。
- SMS は未実装。

## 検証

`tests/inquiry/d1-channels-auth.test.ts`（重複の寄せ・同時受付・条件付き更新の再試行と打ち切り・削除・送信回数の窓・操作履歴の順序、LINE の再送キーと 409・一時／恒久の失敗、メールの MIME とヘッダー注入の拒否、JWT の署名・発行元・AUD・期限・鍵・改ざん・対応表）と `tests/inquiry/worker-app.test.ts`（受付から D1 保存・二重通知、重複送信、送信回数制限、LINE 失敗時の再送と定期実行・`/status` 503、担当者画面のログイン・権限・同一 origin・履歴・削除の確認、保持期限の確認と実行、設定欠落時の 503）。
