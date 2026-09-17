# 残存Issueの再整理 — 2026-09-18

## 見積照合と公開反映の再確認

PR #85のmainマージを確認。#40は実公開のworks/spec両ページで非公開表示と閲覧不可リンクの除去を確認できたため完了。残存は32件。その他は未完了条件を維持し、次は#27/D04の見積と顧客・案件の取り違え防止をPR #86へ追加する（[ADR0073](../architecture/0073-estimate-customer-project-binding.md)）。

## 社内データの競合対策時の再確認

残存33件の本文に前回から変更なし。追加クローズの根拠はなく、#26/#27に関係するD02の同時更新での上書きを優先。社内7CLIの読み込みから保存までの排他を実装する。認証認可・共有ストレージ・HTTPサービス対応は残す（[ADR0072](../architecture/0072-local-ops-command-lock.md)）。

## 監視強化時の再確認

残存33件を取得し、前回の更新済み本文から変更がないことを確認。新たな完了・不要判定の根拠はないため追加クローズは行わない。#32の直接参照CSS・画像の欠落検出を優先して実装する。監視停止の独立検知・通知到達等は継続。[ADR0071](../architecture/0071-referenced-asset-monitoring.md)。

## 公開案内修正時の再評価

前回の35件を再評価し、#14はADR0056で不要となった独自ドメイン必須条件として終了、#37は現行macOSで25ファイルの再現一致を確認して完了。APIでopen **33件**を確認。#40の公開案内はPR #85で修正し、main・公開先確認まで継続する。前回、将来の別OS対応や顧客別の導入確認を元Issueの完了条件へ広げた点を修正した。判断は[ADR0070](../architecture/0070-source-visibility-and-issue-scope.md)。

## 前回の判断と範囲

開始時のopen 41件を全件照合。完了5件（#13 #34 #61 #62 #63）と古い集約1件（#41）のクローズを選び、35件は残条件を明記して継続する。GitHubの全41件の本文を更新し、6件のクローズ・open35件をAPIで再取得して確認済み。Issue本文の旧監査・履歴は保持した。

PR #82〜84はMERGEDでも、マージ先が中間ブランチだった。開始時のmain `931a768`に、提供準備状態による見積制御・復元先保護・公開成果物照合が含まれないことをgit差分で確認した。今回これらを保持してmain向けの一本のPRへ統合する。PRのMERGED表示だけではmain完了と判定しない。

次の一手はこの統合漏れの回収と、#32の配信セキュリティヘッダー監視。価格・CMS受付開始・外部設定は変更しない。残る優先項目は#40の公開説明、#31/#32の独立保管・通知責任、#39/#35の実確認。顧客フォーム/CMS/多言語は該当サービスの提供前条件として維持する。

## 全件の判断

| Issue | 判断 | 実装状況と残る条件 |
| --- | --- | --- |
| [#10](https://github.com/bright-broom/tsumugi/issues/10) | 継続 | 自社受付はメール方式へ変更済み。顧客用フォームの検証・受付コアはあるが、本番アダプタ、永続DB、共有レート制限、障害時の結合試験が残る（監査C04）。 |
| [#11](https://github.com/bright-broom/tsumugi/issues/11) | 継続 | 二系統通知・再送・返信期限のコアは実装済み。実送信アダプタ、ワーカー、通知停止の外部検知と到達確認が残る（C05）。 |
| [#12](https://github.com/bright-broom/tsumugi/issues/12) | 継続 | 事業者情報・電話・メールと自社公開判断は反映済み。LINEは採用しない自社受付。実機でのダイヤラー・メール起動、実到達と担当引継ぎが未確認（B03/B04）。 |
| [#13](https://github.com/bright-broom/tsumugi/issues/13) | 完了・クローズ | 本番/プレビューの分離、仮値・受付・承認の検査と回帰テストはmain実装済み。自社の明示的公開判断だけに限定したWARN例外はADR0056に記録。専門家の実確認は#39で継続する。 |
| [#14](https://github.com/bright-broom/tsumugi/issues/14) | 不要・クローズ | 自社の独自ドメイン取得はADR0056で公開条件から除外済み。顧客案件の導入確認と分離。 |
| [#15](https://github.com/bright-broom/tsumugi/issues/15) | 継続 | CMSの認証、編集、下書き、承認、履歴、静的公開と復元は未実装。該当プランの受付開始前の必須条件（C01）。 |
| [#16](https://github.com/bright-broom/tsumugi/issues/16) | 継続 | 記事モデル・一覧/詳細・下書き除外・ルート生成は実装済み。顧客の入稿枠・承認済み原稿と編集から配備までの接続が残る（C07/#15）。 |
| [#17](https://github.com/bright-broom/tsumugi/issues/17) | 継続 | 事例モデル・静的一覧/詳細・絞り込み基盤は実装済み。実顧客データ、入稿/非公開の公開運用、モバイル受入が残る（C07）。 |
| [#18](https://github.com/bright-broom/tsumugi/issues/18) | 継続 | 地域データ・静的ルート・重複/下書き等の検査は実装済み。実対応地域・原稿の承認と顧客への公開確認が残る（C07）。 |
| [#19](https://github.com/bright-broom/tsumugi/issues/19) | 継続 | スタッフモデル・写真代替説明・公開条件は実装済み。許諾済み顧客素材の配置と更新/退職の公開確認が残る（C07）。 |
| [#20](https://github.com/bright-broom/tsumugi/issues/20) | 継続 | 声のモデル・許諾/依頼表示・公開条件の検査は実装済み。実際の許諾・担当者確認・撤回運用が残る（C07）。 |
| [#21](https://github.com/bright-broom/tsumugi/issues/21) | 継続 | 業種別CTAと外部予約/電話等の設定基盤は実装済み。採用予約先の契約・実接続と代替導線の顧客受入が残る（C07）。 |
| [#22](https://github.com/bright-broom/tsumugi/issues/22) | 継続 | 店舗/例外営業時間・構造化データは実装済み。GBPとの実情報照合、日付境界での再生成・公開運用が残る（C08）。 |
| [#23](https://github.com/bright-broom/tsumugi/issues/23) | 継続 | 日本語以外のカタログ・URL・SEO・翻訳確認は未実装。多言語の準備中表示と見積発行制御はPR#82に実装されたが、PR#85でmain反映済み（C02/C03）。 |
| [#24](https://github.com/bright-broom/tsumugi/issues/24) | 継続 | CSV検証・評価・重複排除・出力CLIは実装済み。実際の入力元・利用条件・運用責任者が未決（D08）。 |
| [#26](https://github.com/bright-broom/tsumugi/issues/26) | 継続 | 依頼・時間・月次集計CLIと無償修補の除外はmain実装済み（PR#81）。顧客用注釈UI・安全な添付・認証認可・完了連絡が残る（D01/D02）。 |
| [#27](https://github.com/bright-broom/tsumugi/issues/27) | 継続 | 顧客/案件/契約/引渡し記録CLIは実装済み。ローカルCLIの同時更新対策はPR#86に追加。利用者の認証認可、共有環境での競合、見積との照合・実移管の確認が残る（D02/D04/D06）。 |
| [#28](https://github.com/bright-broom/tsumugi/issues/28) | 継続 | 出所・欠損を区別する指標CSV取込は実装済み。顧客が認めた実データ源・定期取得と欠損通知が残る（D07）。 |
| [#29](https://github.com/bright-broom/tsumugi/issues/29) | 継続 | 月次Markdown/HTML下書き、欠損・前月比較・修補除外は実装済み。実データ接続、担当者承認と限定共有の運用が残る（D07）。 |
| [#30](https://github.com/bright-broom/tsumugi/issues/30) | 継続 | GBP情報の差分・下書き・承認・実施記録CLIは実装済み。実アカウント、責任者、実反映と確認が残る（D08）。 |
| [#31](https://github.com/bright-broom/tsumugi/issues/31) | 継続 | bundleバックアップと復元CLIあり。PR#83で既存復元先の誤削除を修正しMac/Linuxで復元成功。PR#85でmain反映済み。独立保管先・非公開業務データ・定期運用/通知が残る（A08）。 |
| [#32](https://github.com/bright-broom/tsumugi/issues/32) | 継続 | 直接参照CSS・画像のHEAD検査をPR #85に追加。main反映済み。CSS内部等、独立監視・通知到達・Search Consoleの確認は残る。 |
| [#33](https://github.com/bright-broom/tsumugi/issues/33) | 継続 | 権限関数・保持期限・監査のコアは実装済み。実認証主体との接続、永続化、定期実行、委託先/表示との照合が残る（C06）。 |
| [#34](https://github.com/bright-broom/tsumugi/issues/34) | 完了・クローズ | レポートの日時・commit・成果物指紋・種別・FAIL数を保持し、別commit/失敗/未確認のレポートを表示しない実装と結合テストがmainにある。通常Git配備は「—」、LCPは記録日付き。配備ID照合は別のA05として追跡する。 |
| [#35](https://github.com/bright-broom/tsumugi/issues/35) | 継続 | 20項目の自動/人/外部検査対応は実装済み。人・外部確認18項目の証跡が未記入。自動テストで検収済みと代替しない（B01）。 |
| [#36](https://github.com/bright-broom/tsumugi/issues/36) | 継続 | 画像と文字を分離しi18nから生成する基盤は実装済み。最終素材と実機の欠落/二重読上げ/切取確認を#60と合わせて残す（B04）。 |
| [#37](https://github.com/bright-broom/tsumugi/issues/37) | 完了・クローズ | macOSで再生成25ファイルが既存画像と一致。別OS移行は元Issueの必須条件ではない。 |
| [#38](https://github.com/bright-broom/tsumugi/issues/38) | 継続 | 実績モデルと公開条件は実装済み。許諾済み実案件・実測値の入稿待ち（C07）。 |
| [#39](https://github.com/bright-broom/tsumugi/issues/39) | 継続 | 下書きと承認条件は実装済み。専門家による実確認と指紋・版・日付の記録が残る（B02）。 |
| [#40](https://github.com/bright-broom/tsumugi/issues/40) | 完了・クローズ | PR #85のmain統合と実公開works/specで非公開表示・リンク除去を確認。 |
| [#41](https://github.com/bright-broom/tsumugi/issues/41) | 集約・クローズ | 旧監査の集約Issueは、個別Issueとdocs/product/feature-audit-2026-09-18.mdおよび今回の再整理一覧へ集約。子Issueの未完了条件は維持するため、二重の一覧管理だけを終了する。 |
| [#55](https://github.com/bright-broom/tsumugi/issues/55) | 継続 | 親計画は継続。#61/#62/#63と基盤検査の完了を整理。#12/#56/#57/#58/#59/#60/#64の残条件を個別Issueで追跡する。 |
| [#56](https://github.com/bright-broom/tsumugi/issues/56) | 継続 | 手書きJSのTS化と図解React化は実装済み。装飾HTML/rawの整理、フォント・メニュー操作と実行時JS0の設計が残る（D10/D11）。 |
| [#57](https://github.com/bright-broom/tsumugi/issues/57) | 継続 | 14px下限・中央文字トークンは実装済み。指定の全幅・200%ズーム・将来の全フォント・実機を含む受入条件が残る（B04/#58）。 |
| [#58](https://github.com/bright-broom/tsumugi/issues/58) | 継続 | 閲覧者のフォント選択は未実装。実行時JS0を保った適用/保持範囲と読み込み負荷・支援技術の設計が必要（D10）。 |
| [#59](https://github.com/bright-broom/tsumugi/issues/59) | 継続 | 標準detailsで開閉できるが、外側操作・Esc・フォーカス復帰の要求は未実装。JS0を守るブラウザ標準機能の方式と互換性検証が必要（D10）。 |
| [#60](https://github.com/bright-broom/tsumugi/issues/60) | 継続 | ヒーローの比率・上端・画像内文字のレスポンシブ修正は実装済み。指定の境界幅・200%ズーム・実機を含む受入確認を残す（B04）。 |
| [#61](https://github.com/bright-broom/tsumugi/issues/61) | 完了・クローズ | 所有の横並び比較、限定した比較対象、Lucide図解と連番除去、共通カタログをmainに実装済み。ADR0052の複数幅検査と現行の全項目検査で確認。実機全般の受入は#35/#60で継続する。 |
| [#62](https://github.com/bright-broom/tsumugi/issues/62) | 完了・クローズ | 比較対象の固有名詞を中立表現へ変更済み。参考条件と根拠を保持し、推奨レジストラ等の実名は対象外。法務の承認は#39に残す。 |
| [#63](https://github.com/bright-broom/tsumugi/issues/63) | 完了・クローズ | 制作一時費用・任意保守・外部費・同一期間総額を区別する表示と価格テストをmainに実装済み。後続の料金判断が正本であり、旧357,800円の固定復元は不要。 |
| [#64](https://github.com/bright-broom/tsumugi/issues/64) | 継続 | 料金ページに3社の案内・公式リンク・確認日・更新料/DNS条件を掲載済み。顧客が更新/復旧手段を保持する案内の明記と、リンク先/実機の確認記録を残す。ドメイン購入は対象外。 |

詳細な不足と役割・期限は[機能監査](feature-audit-2026-09-18.md)、実施結果と検証は[status](../status.md)を参照。継続Issueは外部確認待ちだけとは限らず、実装残も含む。
