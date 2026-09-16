# 0024 — 公開条件の検査をプレビューと本番に分け、契約文面の承認を記録する

日付：2026-09-16。状態：採用。関連：[#13](https://github.com/bright-broom/tsumugi/issues/13)、[#39](https://github.com/bright-broom/tsumugi/issues/39)、[#12](https://github.com/bright-broom/tsumugi/issues/12)、[#10](https://github.com/bright-broom/tsumugi/issues/10)。

## 背景

- `verify` の「公開前チェック」は `PLACEHOLDER=true` を WARN にするだけで、ビルドも配備も通った。`false` にしても `TEL`・`DOMAIN`・`EMAIL` に `example` か `0000` が含まれるかしか見ておらず、空の `FORM_ENDPOINT`、住所の「（都道府県）」、担当者の「（名前）」などを検出しなかった。
- Vercel の `buildCommand` は `npm run validate`（最後に `verify -- --static`）で、プレビューと本番の配備で同じ検査だった。確認用のプレビューを許しながら、本番だけを止める手段がなかった。
- `terms.html` は弁護士確認前の下書きだが、「確認前」の注意は `PLACEHOLDER` だけに連動し、承認の版・日付・確認者を残す場所がなかった。

## 決定

### 検査モード

- `npm run verify -- --mode preview|production`。既定は `preview` で、これまでどおり仮の設定のままでも確認できる。
- `--mode` が無いときは Vercel の `VERCEL_ENV` を見て、`production` なら本番モードにする。本番配備で `--mode preview` を指定したら、終了コード 2 で止める（黙って緩い検査にしない）。
- `vercel.json` の `buildCommand`（`npm run validate`）は変えない。Vercel の本番配備（本番ブランチの Git 配備・`vercel --prod`）では `verify -- --static` が自動で本番モードになり、条件を満たすまで配備が失敗する。プレビュー配備と GitHub Actions はプレビューモードのまま。`validate` から検査を外すと本番の条件も外れるため、`buildCommand` を変えるときはこの ADR を見直す。

### 判定

`tools/verify/publication.ts` の `evaluatePublication(snapshot, mode, today)` は、設定のスナップショットだけを受け取る純粋関数。実際の設定からは `publicationSnapshot()` が作る。

| 条件 | 公開に使えないもの |
|---|---|
| `PLACEHOLDER` | `true` |
| `DOMAIN` | 形式外、`example.*`・`.test`・`.invalid`・`localhost` などの予約済みドメイン |
| `TEL` | 0 だけの区切りを含む、桁数・形式外 |
| `EMAIL` | 形式外、予約済みドメイン |
| `POSTAL_CODE` | `123-4567` の形式外、`000-0000` |
| 住所 3 項目・`LEGAL_NAME`・担当者の名前と紹介 | 空、全体が括弧の「（名前）」、`〇〇`・`XXX`・`準備中` |
| `FORM_ENDPOINT` | 空、https でない URL、予約済みドメイン（同じサイトの `/` で始まるパスは可） |
| `LEGAL_APPROVALS.terms` / `.legal` | 版・承認日・確認者の役割・文面の SHA-256 のどれかが無い |
| `ACCEPTANCE_RECORDS` | 人の確認・外部接続の確認の記録が無い仕様の項目がある（[ADR 0026](0026-acceptance-mapping.md)） |

- **本番**：条件ごとに 1 行、満たさなければ FAIL。
- **プレビュー**：満たしていない条件を WARN 1 行にまとめる（既存の WARN 1 件を保つ）。ただし `PLACEHOLDER=false` で仮の値が残っていれば、従来どおり値ごとに FAIL（対象の項目は広げた）。
- 電話番号の値そのものは変えていない（確定値への変更は別の作業）。

### 契約・法務表示の承認記録（#39）

- `src/content/config.ts` の `LEGAL_APPROVALS` に、`terms`（契約・解約・支払い）と `legal`（事業者表示）の承認記録を置く。項目は `version`・`approvedOn`・`reviewerRole`（`attorney` / `other-expert`）・`catalogSha256`。**値はすべて `null` のまま**で、推測で埋めない。
- `catalogSha256` は、承認した文面（`i18n/locales/ja/terms.ts`・`legal.ts` を解決したカタログ）の SHA-256。現在の値は本番モードの FAIL の詳細に出る。承認のあとで文面を変えると一致しなくなる。
- 4 項目が揃うまで `terms.html` は「この文面は、契約書の下書きです（弁護士確認前）」の注意を出し続ける（`PLACEHOLDER || !isApprovalRecorded(...)`）。現在の出力は変わらない。
- 4 項目が揃ってページが確認済みに見える状態で、承認日が不正・未来、または SHA-256 が合わない場合は、**プレビューでも FAIL**（「契約文面の承認」）にする。

## 境界と注意

- 記録は、事業者が専門家の確認を受けたという申告を残すもので、確認の実施そのものはコードで証明できない。
- SHA-256 の対象はカタログの文面だけで、差し込む値（料金・事業者名・住所など）は含まない。事業者情報は上の仮の値の検査、料金は「29 価格の一致」が受け持つ。`LEGAL_NAME` が屋号と同じ「紬」で良いかは自動で判断できないため、`legal` の承認記録で扱う。
- `privacy.html` は承認の対象にしていない。問い合わせ情報の保持・削除の運用（#33）と合わせて決めるときに、`LegalDocumentId` へ足す。
- この変更以降、仮の設定のまま Vercel の本番配備を行うと失敗する。意図した挙動。

## 検証

- Vitest：モード解決、仮の値の判定、本番で各条件が FAIL になること、プレビューが WARN 1 件で通ること、承認記録の不足・不一致、現在の設定がプレビューでは FAIL 0・本番では FAIL になること、`terms.html` の注意の表示条件。
- `npm run verify -- --static`（プレビュー）：FAIL 0、WARN 1（本番の不足 15 件をまとめたもの）。`--mode production`：FAIL 15、終了コード 1。`VERCEL_ENV=production` で `--mode preview`：終了コード 2。

### 2026-09-17：失敗理由の表示漏れを修正

同じ分類の FAIL / WARN は最初の 6 件だけ表示していたため、本番公開条件 12 件のうち後半がログに現れなかった。要対応項目は全件表示する。判定・終了コード・JSON レポートの内容は維持し、本番停止をプレビューへの切り替えで回避しない。全 12 件がログに含まれる回帰テストを追加した。

### 2026-09-17：自社サイトの公開指示

[ADR 0056](0056-owner-authorized-publication.md) により、紬の自社サイトはオーナーの公開判断を独立して記録する。記録の範囲内の未実施確認を WARN として残し、専門家確認・納品検収の完了とは区別する。顧客案件は従来の条件を維持する。
