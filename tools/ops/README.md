# 社内ツール（tools/ops）

顧客対応・営業・運用のための CLI。公開サイト（`out/`）とは別で、サイトからは読み込まない。
判断の理由は [ADR 0036](../../docs/architecture/0036-internal-ops-tools-and-estimates.md)。

## 実データの扱い

- **このリポジトリは Public。顧客・見込み客・売上の実データをコミットしない。**
- 実データの既定の置き場所は `.data/`（git 管理外）。`--data <dir>` か `TSUMUGI_DATA_DIR` で変えられるが、リポジトリ内では `.data/`・`.artifacts/` 以外への書き込みを拒否する。
- `tools/ops/fixtures/` には架空のサンプルだけを置く。
- ツールは外部 API を呼ばず、メール・投稿などの送信もしない。

## 見積もり（`npm run ops:estimate`）

金額はすべて `src/content/prices.ts` から計算する。条件を JSON で書いて渡す（例：[fixtures/estimate-basic.json](fixtures/estimate-basic.json)）。

```sh
npm run --silent ops:estimate -- quote  --input tools/ops/fixtures/estimate-basic.json   # 計算だけ（JSON）
npm run --silent ops:estimate -- save   --input <条件.json> [--note <メモ>]              # 新しい版として保存
npm run --silent ops:estimate -- diff   --id <見積番号> --from 1 --to 2                 # 版の差額
npm run --silent ops:estimate -- render --id <見積番号> --format md|html [--version N] [--out <file>]
```

| 入力                          | 内容                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `production`                  | `single`・`basic`・`standard`、または `null`（制作なし）。受付準備中のプランは保存できない |
| `options`                     | `[{ "key": "page_add", "quantity": 2 }]`。キーは `prices.ts` の `OPTIONS`                  |
| `support` / `months`          | 継続支援のキー（`run_self` など）と期間（0〜120 か月）                                     |
| `payment`                     | `deposit_acceptance`（着手時・検収時）だけ                                                 |
| `issuedOn` / `validUntil`     | 発行日と有効期限                                                                           |
| `assumptions` / `unconfirmed` | 前提条件と未確定の事項。書面にそのまま載せる                                               |

- 金額の各行は「確定」「目安（別見積もり）」「仮置き」のどれかを持つ。外部費は常に仮置き。
- 消費税は請求の回ごとに計算する（合計に一度掛けた額と 1 円ずれることがある）。
- 書面は保存した版の金額のまま出す。保存後に料金表が変わっていれば、出力時に注意を出す。
- 印刷用 HTML は JavaScript を含まない。PDF はブラウザの印刷で作る。

## 顧客運用の指標（`npm run ops:metrics`）

計測タグは入れない。顧客が同意したデータ源の集計 CSV を取り込む（[ADR 0037](../../docs/architecture/0037-customer-metrics-and-monthly-reports.md)）。

1. `<データの置き場所>/metrics/<顧客ID>/sources.json` にデータ源を登録する（例：[fixtures/metrics/sources.json](fixtures/metrics/sources.json)）。指標の定義と同意の記録は必須。
2. CSV を、そのファイルが網羅している期間と一緒に取り込む。

```sh
npm run --silent ops:metrics -- check   --customer sample-shop
npm run --silent ops:metrics -- import  --customer sample-shop --source inquiry-intake --file <CSV> --from 2026-08-01 --to 2026-08-31
npm run --silent ops:metrics -- summary --customer sample-shop --month 2026-08 [--json]
npm run --silent ops:metrics -- imports --customer sample-shop
npm run --silent ops:metrics -- remove-import --customer sample-shop --sha <先頭 8 文字以上>
```

| データ源の種類         | CSV の列                                                  | 指標                                                        |
| ---------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| `server_log_aggregate` | `date,metric,dimension,value`（値の空欄は欠損）           | `page_views`・`visits`・`referrals`（`dimension` に参照元） |
| `event_log`            | `occurred_at,metric,channel,ref`（1 行 1 件、`ref` 必須） | `inquiries`・`bookings`                                     |

- 表示は「N件」（0 を含む計測値）・「未計測」（データ源がない／計測期間外）・「欠損あり」（計測しているが欠けた日がある）の 3 通り。欠損した月の途中までの値は合計として出さない。
- 同じファイルの再取り込み、同じデータ源で期間が重なる取り込みは拒否する。

## 修正依頼と作業時間（`npm run ops:requests`）

依頼は顧客ごとに `<データの置き場所>/requests/<顧客ID>.json` に記録する（[ADR 0038](../../docs/architecture/0038-requests-and-customer-projects.md)）。

```sh
npm run --silent ops:requests -- init   --customer sample-shop --since 2026-09-01
npm run --silent ops:requests -- add    --customer sample-shop --url https://example.jp/menu.html --selector "main h2" --x 120 --y 480 --viewport 390 --description "見出しを差し替える" --channel 電話 --by 担当者 [--attach <保管場所>] [--due 2026-09-20]
npm run --silent ops:requests -- move   --customer sample-shop --id req-0001 --to in_progress --by 担当者
npm run --silent ops:requests -- log    --customer sample-shop --id req-0001 --minutes 25 --by 担当者 [--date 2026-09-16]
npm run --silent ops:requests -- move   --customer sample-shop --id req-0001 --to awaiting_review --by 担当者
npm run --silent ops:requests -- move   --customer sample-shop --id req-0001 --to done --by 担当者
npm run --silent ops:requests -- notice --customer sample-shop --id req-0001 --channel 電話 --by 担当者
npm run --silent ops:requests -- list   --customer sample-shop
npm run --silent ops:requests -- hours  --customer sample-shop --month 2026-09 --plan run_basic
```

- 状態は 受付 → 着手 → 確認待ち → 完了。確認待ちからは差し戻し（着手）もできる。
- 月の作業時間は、月の合計を 5 分単位で切り上げる（依頼ごとには切り上げない）。3 か月平均は 3 か月とも月初から記録している場合だけ出す。
- 完了連絡は記録だけで、送信はしない。顧客ごとのアクセス権限は未実装（オーナーのローカル環境で使う）。

## 月次レポートの下書き（`npm run ops:report`）

指標・修正依頼・手入力の GBP 実績から、対象月の下書きを作る（[ADR 0037](../../docs/architecture/0037-customer-metrics-and-monthly-reports.md)）。

```sh
npm run --silent ops:report -- generate --customer sample-shop --month 2026-09 --label 架空の商店 --plan run_basic [--note "確認事項"] [--format html]
npm run --silent ops:report -- approve  --customer sample-shop --month 2026-09 --by 確認者
npm run --silent ops:report -- status   --customer sample-shop --month 2026-09
```

GBP の実績は管理画面を見て `<データの置き場所>/gbp/<顧客ID>/performance/<YYYY-MM>.json` に転記する。

```json
{
  "customerId": "sample-shop",
  "month": "2026-09",
  "source": "GBP 管理画面の実績を転記",
  "enteredBy": "担当者",
  "enteredOn": "2026-10-01",
  "items": [
    { "label": "画面の項目名", "value": 12 },
    { "label": "確認できなかった項目", "value": null }
  ]
}
```

- 下書きは確認前の文書。`approve` は確認した内容の SHA-256 を記録し、作り直して内容が変われば確認は無効になる。
- 送信・共有はしない。確認後の書面は人が渡す。

## 顧客管理と案件の進行（`npm run ops:crm`）

顧客ごとに `<データの置き場所>/crm/<顧客ID>.json` に記録する（[ADR 0038](../../docs/architecture/0038-requests-and-customer-projects.md)）。

```sh
npm run --silent ops:crm -- init     --customer sample-shop --name 架空の商店 --owner 担当者 --by 担当者
npm run --silent ops:crm -- consult  --customer sample-shop --channel 電話 --summary "作り直しの相談" --by 担当者
npm run --silent ops:crm -- project  --customer sample-shop --project site-2026 --title サイト制作 --by 担当者
npm run --silent ops:crm -- estimate --customer sample-shop --project site-2026 --estimate est-sample-001 --version 2 --by 担当者
npm run --silent ops:crm -- advance  --customer sample-shop --project site-2026 --to estimate_sent --by 担当者
npm run --silent ops:crm -- contract --customer sample-shop --project site-2026 --version 1 --status signed --signed-on 2026-09-18 --ref <書面の保管場所> --by 担当者
npm run --silent ops:crm -- approval --customer sample-shop --project site-2026 --id copy-top --kind copy --item トップの原稿 --status approved --decided-by お客様 --decided-on 2026-09-20 --by 担当者
npm run --silent ops:crm -- check    --customer sample-shop --project site-2026 --key verify-fail-zero --evidence <検査レポート> --by 担当者
npm run --silent ops:crm -- handover --customer sample-shop --project site-2026 --item github_invite --permission read --ref <招待先> --by 担当者
npm run --silent ops:crm -- show     --customer sample-shop
npm run --silent ops:crm -- export   --customer sample-shop --out .data/exports/sample-shop.json
```

| 状態                           | 進める前提                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `estimate_sent` 見積提出       | 見積の版が紐付いている                                                                                |
| `contracted` 契約済み          | 締結済みの契約の版がある                                                                              |
| `in_production` 制作中         | —                                                                                                     |
| `awaiting_acceptance` 検収待ち | 原稿・写真の承認がそれぞれあり、すべて承認済み                                                        |
| `accepted` 検収済み            | 納品チェック（検査 FAIL 0・ドメインがお客様名義・パスワード類をソースに入れていない）が根拠つきで完了 |
| `handed_over` 引渡し済み       | ソースコード・手順書・写真の元データ・GitHub 閲覧招待（read のみ）の記録                              |

- `show` は、次に進める状態と足りない前提を一覧で出す。
- 他の顧客の情報を読めない権限は未実装（ファイルの分離と顧客 ID の照合まで）。
