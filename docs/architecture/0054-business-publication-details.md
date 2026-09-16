# 0054 — 確定した事業者情報と契約文面の下書きを公開設定へ反映する

日付：2026-09-17。状態：採用（専門家の確認・本番公開は未完了）。

## 背景と決定

本番公開条件で止まる Vercel ログの修正依頼に対し、ユーザーが公開先を既存 Vercel URL、事業者を個人事業主「作田 敏希」、紹介名を Toshiki・Yuka と指定した。郵便番号と住所も指定を受けた。利用規約・法定表示は未確認だが作成を委任された。

- Vercel CLI の inspect で `tsumugi-six.vercel.app` がプロジェクト tsumugi の既存本番エイリアスであることを確認。DOMAIN に設定し、canonical・OGP・構造化データ・サイトマップへ共通反映する。確認時点の既存配備は今回のソース変更を含まない。
- 氏名・住所・プロフィールは既存の日本語カタログに置く。法定表示の販売事業者・運営責任者は LEGAL_NAME を参照し、紹介用の通称を使わない。
- 紹介文は担当内容を説明する。資格・勤務歴・成果数値を新たに推測しない。
- 既存の価格・任意保守・支払方法を維持し、合意する内容と契約成立時点、納品確認、中止時の作業・合意済み取消不能費用の明細精算、超過支払額の返金、仕様不一致の修正を利用規約・法定表示へ追記する。
- 専門家確認済みとは扱わず、両ページに下書き表示を残す。LEGAL_APPROVALS と ACCEPTANCE_RECORDS を推測で埋めず、PLACEHOLDER を維持する。公開条件の正本は [ADR 0024](0024-publication-gates.md)。

## 参照

2026-09-17 に消費者庁の [通信販売の広告表示](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php) と [広告の Q&A](https://www.no-trouble.caa.go.jp/qa/advertising.html) を参照。事業者名を通称から推測せず正式氏名をユーザーに照会した。これらの参照は、本件の契約文面に対する専門家の承認を意味しない。

## 表示と検証

既存の Section・Table・Note、中央管理の Tailwind CSS を使用。新しいパッケージ・UI 素材は採用しない。共通フロントエンドガイドに従い、公開時の実行時 JS 0 を維持する。

- validate 成功：型・lint・Vitest 484 件・料金モデル 12 件・21 ページの静的出力。
- 全項目 verify：PASS 575 / WARN 1 / FAIL 0。静的プレビュー：PASS 318 / WARN 1 / FAIL 0。
- 本番静的：PASS 331 / WARN 0 / FAIL 4。残る条件は PLACEHOLDER、LEGAL_APPROVALS.terms、LEGAL_APPROVALS.legal、ACCEPTANCE_RECORDS。停止理由を省略せず報告する。
- サイトマップの通常テストは中央の DOMAIN を参照。架空の記事テストはドメインを明示して実サイト設定と分離する。
- Chromium・JS 無効、幅 1440 / 390 / 320 px で about・legal・terms・contact の canonical と横はみ出しなしを確認。氏名・住所・下書き表示、プロフィール名、契約成立と返金の文言を出力で確認。法定表示は PC・狭幅の画像も目視。実機確認やメール受信・電話到達の実試験は未実施。

## 本番公開に残る作業

専門家が実際の契約文面を確認した後、版・日付・確認者の役割・文面ハッシュを記録する。事業者による内容確認と外部接続の試験を実施し、[受入確認](0026-acceptance-mapping.md)の記録を残す。その後 PLACEHOLDER を false にし、本番モードで FAIL 0 を確認してから配備する。
