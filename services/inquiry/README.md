# 問い合わせ受付サービス（Cloudflare Workers ＋ D1）

顧客サイトでメールフォームを採用する場合の受付サービス。紬の自社サイトはメールと電話で受け付けており、このサービスを使っていない。判断の理由は [ADR 0079](../../docs/architecture/0079-inquiry-service-on-workers.md)、データの扱いは [問い合わせデータ](../../docs/inquiry-data.md)。

| 経路                | 内容                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------- |
| `POST /inquiry`     | 受付。保存 → メールと LINE の二重通知 → 結果の画面。JavaScript なしのフォーム送信で動く |
| `GET /status`       | 通知の失敗・遅延があれば 503。区分ごとの件数だけを返す（外部監視用）                    |
| `/admin`            | 担当者の画面。受付一覧・詳細・初回返信・契約状態・法的保全・削除・保持期限・操作履歴    |
| 定期実行（5分ごと） | 期限の来た通知の送信と再送、失敗・遅延の記録、送信回数の古い記録の削除                  |

## 配備の手順

実在の宛先に送る前に、テスト用の宛先・アカウントで次を確かめる。費用・規約（無料枠、超過時の挙動、商用利用）は各社の公式ページで確認し、確認日を ADR 0079 に追記する。

1. Cloudflare にサイトのドメインを置き、Email Routing で担当者の受信アドレスを確認済みにする（送信はこの宛先だけに届く）。
2. D1 を作り、スキーマを入れる。

   ```sh
   npx wrangler d1 create inquiry
   npx wrangler d1 migrations apply inquiry --remote
   ```

3. `wrangler.example.toml` を `wrangler.toml` に写し、サイトの origin・送信元・宛先・D1 の ID・Access の値を入れる。`wrangler.toml` に鍵を書かない。
4. 鍵と担当者の対応表を Secret に入れる。

   ```sh
   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   npx wrangler secret put STAFF_ACCESS   # {"担当者のメール":"member-1","もう1人":"member-2"}
   ```

   担当者 ID は `src/content/inquiry.ts` の `INQUIRY_STAFF`。2名まで、管理者を1名以上。

5. Cloudflare Access（Zero Trust）で、`<サービスのドメイン>/admin*` を担当者2名のメールだけに許可するアプリケーションを作る。チームのドメインと AUD タグを `ACCESS_TEAM_DOMAIN`・`ACCESS_AUD` に入れる。Access を通らない要求は、サービス側でも 401 にする。
6. `npx wrangler deploy` で配備する。
7. サイト側で `src/content/config.ts` の `CONTACT_METHOD = 'form'`、`FORM_ENDPOINT = 'https://<サービスのドメイン>/inquiry'` にして再ビルドする。
8. テスト用の内容で送信し、受付番号の表示・メールと LINE の到着・担当者画面の表示・初回返信の記録を確かめる。LINE の宛先を一時的に誤らせて `/status` が 503 になることも確かめる。
9. サイトの監視に `/status` を加える。

## 残る条件

- 実送信・実配備はこのリポジトリでは行っていない（テストは本物の SQLite と模擬の LINE・Access で実施）。
- 通知が両方とも失敗した場合、担当者へは届かない。`/status` の外部監視と、Workers のログで検知する。
- 保持期限による削除は、担当者画面で対象を確認してから実行する（自動では削除しない）。
- SMS は実装していない（通数ごとの費用のため、LINE を先に使う）。
