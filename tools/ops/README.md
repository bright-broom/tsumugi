# 社内ツール（tools/ops）

顧客対応・営業・運用のための CLI。公開サイト（`out/`）とは別で、サイトからは読み込まない。
判断の理由は [ADR 0036](../../docs/architecture/0036-internal-ops-tools-and-estimates.md)。

## 実データの扱い

- **顧客・見込み客・売上の実データをコミットしない。** リポジトリの公開範囲はオーナーが決める（2026-09-18 の確認では Private。ADR 0070）。Private でも、閲覧できる人・引渡し資料・バックアップに広がる。
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

## 請求書と入金（`npm run ops:invoice`）

保存した見積の版と、顧客管理の契約・案件の状態から請求書を作り、入金を記録する（[ADR 0078](../../docs/architecture/0078-invoices-and-payments.md)）。送信・決済・会計サービスとの連携はしない。書面は人が渡す。

最初に `<データの置き場所>/billing/profile.json` へ振込先とインボイス登録の状況を記録する（形式は架空の例 [fixtures/billing-profile.json](fixtures/billing-profile.json)）。このファイルは git 管理外に置き、実際の口座をコミットしない。登録済みなら `{ "status": "registered", "number": "T＋13桁" }`。

```sh
npm run --silent ops:invoice -- profile
npm run --silent ops:invoice -- issue   --customer sample-shop --project site-2026 --estimate est-sample-001 --version 2 --kind deposit --issued-on 2026-09-18 --due 2026-09-30 --by 担当者
npm run --silent ops:invoice -- issue   --customer sample-shop --project site-2026 --estimate est-sample-001 --version 2 --kind monthly --period 2026-10 --issued-on 2026-10-01 --due 2026-10-31 --by 担当者
npm run --silent ops:invoice -- pay     --customer sample-shop --invoice inv-202609-001 --amount 137500 --received-on 2026-09-25 --ref "通帳 9/25" --by 担当者
npm run --silent ops:invoice -- void    --customer sample-shop --invoice inv-202609-001 --reason 宛名の誤り --by 担当者
npm run --silent ops:invoice -- list    --customer sample-shop
npm run --silent ops:invoice -- receivables
npm run --silent ops:invoice -- render  --customer sample-shop --invoice inv-202609-001 --format html
```

| `--kind`     | 発行できる時期                                 | 金額                                            |
| ------------ | ---------------------------------------------- | ----------------------------------------------- |
| `deposit`    | 契約締結済み・案件が契約済み以降               | 見積の「着手時（制作本体）」                    |
| `acceptance` | 案件が検収済み以降。着手時と同じ見積の版だけ   | 見積の「検収時（制作本体）」                    |
| `options`    | 契約済み以降。目安額（別見積もり）を含むと不可 | 見積のオプション合計                            |
| `monthly`    | 契約済み以降。対象月ごとに1件                  | 見積の継続支援（月額）。0円のプランは発行しない |

- 金額は保存済みの見積の版からだけ取る。手入力の金額・値引きは受け付けない。変わる場合は見積の新しい版を保存し、案件に紐付けてから請求する。
- お支払期限は規約に日数の定めがないため、発行のたびに `--due` で指定する。
- 請求番号は全顧客で月ごとの通し番号（`inv-YYYYMM-001`）。同じ請求の二重発行は止める。訂正は取消（void）してから発行し直し、取消した番号は欠番として残す。入金のある請求書は取消できない。
- 発行者（屋号・氏名・所在地・連絡先）は `src/content/config.ts`、振込先と登録状況は profile.json の、発行時の値を請求書に写す。後から設定を変えても発行済みの書面は変わらない。
- インボイス未登録では登録番号を載せず、「本書は適格請求書ではありません」と明記する。登録済みでは登録番号と税率ごとの消費税を載せる。消費税の表示・計算を免税事業者としてどう扱うかは税理士に確認する。
- 入金は根拠（通帳・振込明細）付きで記録し、残額を超える入金は記録しない（返金・充当は人が判断する）。`receivables` は全顧客の未回収を期限順に出し、期限超過があれば終了コード 1。

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
npm run --silent ops:requests -- log    --customer sample-shop --id req-0001 --minutes 25 --kind change --by 担当者 [--date 2026-09-16]
npm run --silent ops:requests -- move   --customer sample-shop --id req-0001 --to awaiting_review --by 担当者
npm run --silent ops:requests -- move   --customer sample-shop --id req-0001 --to done --by 担当者
npm run --silent ops:requests -- notice --customer sample-shop --id req-0001 --channel 電話 --by 担当者
npm run --silent ops:requests -- list   --customer sample-shop
npm run --silent ops:requests -- hours  --customer sample-shop --month 2026-09 --plan run_basic
```

- 状態は 受付 → 着手 → 確認待ち → 完了。確認待ちからは差し戻し（着手）もできる。
- 新しい作業記録は `--kind change`（通常変更）または `--kind warranty`（紬側の仕様不適合の無償修補）を必須にする。修補には `--note "合意仕様との差異と修補内容"` も必要。区分や修補の根拠がない記録は保存しない。
- 実作業時間は全記録を保持し、通常変更の月合計だけを 5 分単位で切り上げて変更枠を消費する。修補は枠消費 0。依頼ごとに丸めず、自動追加課金もしない。CLI と月次レポートに内訳を表示する。
- `kind` のない旧記録はそのまま読めるが、通常変更とは推測しない。未分類のある月は消費・残り・超過を未確定とし、3 か月平均も出さない。月初から記録していない月についても残り・超過の確定表示は出さない。
- 旧記録を分類する場合は元の JSON を別名で保管し、依頼・合意仕様を確認した担当者が該当作業に `kind` と、確認者・確認日・根拠を `note` に追記する。時間・日付・作業者は変えない。根拠のないものは未分類のまま残す。自動移行・訂正履歴管理・請求は未実装。再生成した月次下書きには再確認が必要（既存の SHA 検査で旧承認を無効化）。[ADR 0065](../../docs/architecture/0065-warranty-work-accounting.md)。
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
npm run --silent ops:crm -- account  --customer sample-shop --project site-2026 --id domain --kind domain --service お名前.com --holder customer --ref "お客様のアカウント（管理画面）" --access revoked --transferred-on 2026-09-20 --revoked-on 2026-09-24 --by 担当者
npm run --silent ops:crm -- handover --customer sample-shop --project site-2026 --item github_invite --permission read --ref <招待先> --by 担当者
npm run --silent ops:crm -- show     --customer sample-shop
npm run --silent ops:crm -- export   --customer sample-shop --out .data/exports/sample-shop.json
```

| 状態                           | 進める前提                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `estimate_sent` 見積提出       | 見積の版が紐付いている                                                                                       |
| `contracted` 契約済み          | 締結済みの契約の版がある                                                                                     |
| `in_production` 制作中         | —                                                                                                            |
| `awaiting_acceptance` 検収待ち | 原稿・写真の承認がそれぞれあり、すべて承認済み                                                               |
| `accepted` 検収済み            | 納品チェック（検査 FAIL 0・ドメインがお客様名義・パスワード類をソースに入れていない）が根拠つきで完了        |
| `handed_over` 引渡し済み       | ドメイン・ホスティングがお客様名義。ソースコード・手順書・写真の元データ・GitHub 閲覧招待（read のみ）の記録 |

- `show` は、次に進める状態と足りない前提を一覧で出す。
- `account` は、ドメイン・ホスティングなどの名義（`--holder`）と、引渡し後の紬のアクセス（`--access revoked|retained`）を記録する。パスワード・鍵・トークンらしき文字列は受け付けない（`--ref` は管理画面の名前まで）。
- 他の顧客の情報を読めない権限は未実装（ファイルの分離と顧客 ID の照合まで）。

## 引渡し資料の梱包（`npm run ops:handover`）

検収済みの案件について、ソース一式（履歴ごと）・元素材・引渡し書・名義とアクセス・検査の実績を 1 つのフォルダにまとめ、別のフォルダで作り直せたことを確かめてから封（`SHA256SUMS`）をする（[ADR 0082](../../docs/architecture/0082-handover-package.md)）。

```sh
npm run --silent ops:handover -- plan   --customer sample-shop --project site-2026
npm run --silent ops:handover -- pack   --customer sample-shop --project site-2026 --by 担当者 --material <写真の元データのフォルダ>
npm run --silent ops:handover -- verify --package .artifacts/handover/sample-shop-site-2026-20260924 --deps ci --build build
npm run --silent ops:handover -- record --customer sample-shop --project site-2026 --package .artifacts/handover/sample-shop-site-2026-20260924 --github <招待先> --by 担当者
npm run --silent ops:crm      -- advance --customer sample-shop --project site-2026 --to handed_over --by 担当者
```

| 段階     | すること                                           | 止まる条件                                                                                               |
| -------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `plan`   | 引き渡せる状態かを見る                             | 検収前・納品チェック未了・ドメイン／ホスティングが未記録かお客様名義でない・検査の実績がない             |
| `pack`   | `source/`・`materials/`・引渡し書・`handover.json` | 未コミットの変更・浅い clone・秘密情報の形・同じ日の資料がある・別のコミットや静的検査だけの検査レポート |
| `verify` | 別のフォルダへ取り出してビルドまで通し、封をする   | 取り出しかビルドの失敗・`--build build` 以外・封のある資料                                               |
| `record` | CRM の引渡し記録にする                             | 封がない・封と中身が合わない・顧客や案件が資料と違う                                                     |

- 引渡し書に載せる検査の実績は、全項目・FAIL 0・引き渡すコミットと同じ・未コミットの変更なしのレポートからだけ取る（[ADR 0025](../../docs/architecture/0025-verified-build-report.md)）。既定は `.artifacts/verification/verify-report.json`。
- パスワード・鍵・トークンは同梱しない。元素材に `.env*`・鍵ファイル・秘密情報の形があれば梱包しない。ログイン情報は別の経路で渡す。
- 資料の置き場所は `.artifacts/`・`.data/` かリポジトリの外（顧客名の入った資料を追跡対象に置かない）。

## 営業リスト（leadfinder、`npm run ops:leads`）

オーナーが用意した CSV を取り込む。自動収集・自動送信はしない（[ADR 0039](../../docs/architecture/0039-leadfinder-and-gbp-sync.md)）。台帳は `<データの置き場所>/leads/ledger.json`。

```sh
npm run --silent ops:leads -- import --file tools/ops/fixtures/leads-sample.csv --source "入力元の名前" --collected-on 2026-09-10 --retention-days 30
npm run --silent ops:leads -- list   --industry 飲食 --area 架空市 --min-score 60 [--state needs_review] [--site portal_only]
npm run --silent ops:leads -- review --id <見込み客ID> --state reviewed --by 担当者 --note "電話で確認した内容"
npm run --silent ops:leads -- purge
npm run --silent ops:leads -- export --out .data/exports/leads.csv [--include-needs-review]
```

- CSV の列：`name`（必須）、`phone`・`website`・`industry`・`area`・`rating`・`review_count`・`place_id`（任意）。
- 取り込みごとに入力元・収集日と、保存期限（`--retention-days`）か `--no-expiry` のどちらかを必ず指定する。利用条件はオーナーが確認する。
- 電話・URL・place_id が同じなら 1 件にまとめる。店名と地域だけが同じ候補はまとめずに要確認にする。
- 優先度はガイドラインの配点（口コミ数 45・評価 20・電話番号 20・サイト状態 15）。口コミ数と評価の配り方は仮置きで、根拠の列に書く。
- CRM への CSV は確認済みだけ（指定で要確認も）。保存期限を過ぎた情報が残っていれば出力せず、`purge` で place_id と確認メモ以外を捨てる。

## GBP の突き合わせと承認の記録（`npm run ops:gbp`）

API は使わない。GBP に投稿・返信する機能はない（[ADR 0039](../../docs/architecture/0039-leadfinder-and-gbp-sync.md)）。

```sh
npm run --silent ops:gbp -- compare --customer sample-shop --site tools/ops/fixtures/gbp/site-profile.json --gbp tools/ops/fixtures/gbp/gbp-profile.json
npm run --silent ops:gbp -- change  --customer sample-shop --id hours-sat --field "営業時間（土）" --value "11:00-21:00" --target gbp --by 担当者
npm run --silent ops:gbp -- change-approve --customer sample-shop --id hours-sat --by お客様
npm run --silent ops:gbp -- change-applied --customer sample-shop --id hours-sat --by 担当者 --evidence "管理画面の表示を確認"
npm run --silent ops:gbp -- draft   --customer sample-shop --id post-0920 --kind post --due 2026-09-20 --text-file <文面.txt> --by 担当者
npm run --silent ops:gbp -- approve --customer sample-shop --id post-0920 --by お客様
npm run --silent ops:gbp -- done    --customer sample-shop --id post-0920 --by 担当者 --evidence "公開後の表示を確認"
npm run --silent ops:gbp -- due     --customer sample-shop
```

- プロフィールは店名・住所・電話・ウェブサイト・予約先・曜日ごとの営業時間・臨時営業時間を持つ（例：[fixtures/gbp/](fixtures/gbp/)）。結果は「一致」「表記ゆれ」「不一致」「片方だけ」で、不一致・片方だけがあれば終了コード 2。
- 変更は提案 → 承認 → 反映の記録。承認のない変更は反映済みにできない。
- 投稿・口コミ返信は下書き → 承認 → 実施の記録。承認した文面から変わっていれば実施を記録できず、文面を直すと承認は外れる。

### 見積と提供準備状態（ADR 0066）

制作・追加オプションの提供状態は `src/content/prices.ts` の `preparing` が正本。`firm` は価格の確定度だけを表す。多言語は言語別出力・翻訳範囲・表示品質の検証前のため受付準備中。価格は変更せず、料金表と全プラン比較でも状態を表示する。

- `quote` は試算で、準備中を含む場合は `blockers` に理由を出す。発行できるという意味ではない。
- `save` は準備中・提供状態未指定の商品の保存を拒否する。保存済みの版も `render` 時に現行の状態を確認し、準備中なら Markdown / HTML の発行を拒否する。既存 JSON・出力ファイルは変更しない。過去の内容は元 JSON と `diff` で確認できる。
- 提供可能な商品の旧版は保存時の価格で出力する。料金表が変わった場合は警告し、同じ入力でも新しい価格表で別の版を保存できる。過去の版は書き換えない。
- 受付を開始する場合は、商品ごとの提供手順と検証証跡を確認したうえで `preparing: false` に変更し、サイト・保存・再出力の検査を行う。フラグだけで実装・外部契約の準備完了を保証するものではない。

[判断の記録](../../docs/architecture/0066-estimate-readiness.md)。

## 同じ保存先で操作が重なった場合

7種類の社内CLIは、同期コマンドの開始前に保存先直下の`.ops-lock`を排他的に取得し、読み込みから保存・出力まで保持します。別の操作が実行中なら保存せず終了1となります。先行操作の終了後に、最新のデータを読み直すためコマンドを再実行してください。helpはロックが残っていても表示できます。

強制終了後などで停止が続く場合は、エラーに示された`.ops-lock`のPID・host・startedAtを確認し、そのホストで対象の操作が終了していることを確かめます。PID再利用や別ホストの可能性があるため、古い時刻やPIDだけでは削除しません。保存先を使う他の操作を止め、データを保全したうえで、停止確認済みのロックファイルだけを手動で取り除き、再実行します。実行中か確認できなければ残してください。アプリは既存ロックを自動削除しません。

対象は単一端末のローカル保存先で、このCLIを使う操作です。ネットワーク共有・手編集・HTTPサービス・異なる保存先から同じ外部出力ファイルへの書き込みは対象外。認証認可や複数ファイルの一括ロールバックは別途必要です（[ADR0072](../../docs/architecture/0072-local-ops-command-lock.md)）。

### 見積の顧客・案件ID

保存する入力JSONには`customerId`と`projectId`を指定する（サンプルは`sample-shop` / `site-2026`）。同じ見積番号の改版で別の顧客・案件には変更できない。CRMのestimate操作は同じ保存先の見積ファイル・指定版・顧客・案件を照合してから記録する。

IDのない旧見積は試算・既存書面の参照が可能だが、改版保存・新しいCRM紐付けはできない。内容と帰属を担当者が確認し、新しい見積番号で保存する。旧ファイルを書き換えて移行したことにしない。契約との照合・実際の宛先確認は別に行う。[ADR0073](../../docs/architecture/0073-estimate-customer-project-binding.md)。

### 案件を進める前の見積確認

`advance`で見積提出・契約済み・制作中へ進む際は、紐付け済みの全見積の存在・指定版・顧客・案件を再確認する。`show`にも停止理由が出る。見積欠落時は正しいバックアップから復元し、旧データの帰属や参照違いは担当者が確認して修復する。ロックを外して再実行するだけでは解決しない。相談への差し戻しや中止は可能。[ADR0074](../../docs/architecture/0074-crm-transition-estimate-validation.md)。
