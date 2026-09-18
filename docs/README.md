# ドキュメント

自社のサービスサイトと、顧客に納品するサイトを**同じコードベースで作る**ための一式です。
自社サイトが標準仕様の1号案件になり、そのまま顧客サイトのテンプレート資産になります。

サイトの主張は1つに絞ってあります。**「いまのホームページは借地権、紬がつくるのは所有権」**。
ページの並び・図・章題・OGPの文面は、すべてこの一文を支えるために配置されています
（→ [サイトの主張と値付け](product/messaging-and-pricing.md)）。

デザインは **NOT A HOTEL デザインガイドライン v2.0** に準拠しています（→ [デザイン](product/design.md)）。

| 知りたいこと                                                                             | 文書                                                                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **開発を引き継ぐとき（人・AI）の入口**                                                   | [../AGENTS.md](../AGENTS.md)                                                                           |
| **別の AI・端末で作業を再開する手順**                                                    | [handoff.md](handoff.md)                                                                               |
| **いまの状態と残課題**                                                                   | [status.md](status.md)                                                                                 |
| 事業の規範（何を売り、何を売らないか・営業・納品・運用・法令）                           | [business/紬_ビジネスガイドライン.md](business/紬_ビジネスガイドライン.md)                             |
| 事業の数字（料金レバー・プラン・補助金・掲載費）                                         | [business/紬_事業の中身.xlsx](business/紬_事業の中身.xlsx)                                             |
| 旧料金設計の履歴：月140時間で採用した料金体系・提供範囲・採算・検証計画                                    | [business/pricing-redesign-140h.md](business/pricing-redesign-140h.md)                                 |
| 上位商品の検討案（未採用）：CMS・個別開発の範囲、採算、顧客価値、商品化の条件            | [business/premium-pricing-proposal.md](business/premium-pricing-proposal.md)                           |
| 全プランの比較・料金試算（現行と未採用案を区別）：制作、月額、追加オプション、総額、採算 | [business/紬_全プラン比較・料金試算.xlsx](business/紬_全プラン比較・料金試算.xlsx)                     |
| 料金改定を引き継ぐ：正本・旧案・Excel入力箇所・再計算 | [料金の引き継ぎ](business/pricing-maintenance.md) |
| 現在の採用料金・範囲・原価仮定 | [2026-09-18新料金表](business/pricing-2026-09-18.md) |
| 費用総点検（未採用案）：原価・工数・外部費・改定案 | [費用レビュー](business/cost-review-2026-09-18.md)・[試算Excel](business/紬_費用総点検_2026-09-18.xlsx) |
| サイトの主張・値付け・約束の置き場所・屋号・数字の出典                                   | [product/messaging-and-pricing.md](product/messaging-and-pricing.md)                                   |
| 全ページの役割と共通情報の管理                                                           | [product/information-architecture.md](product/information-architecture.md)                             |
| 繰り返すデザイン変更の編集場所・共通部品・表示比較                                       | [product/redesign-guide.md](product/redesign-guide.md)                                                 |
| デザインの出所・スマホ表示・図・共有カード                                               | [product/design.md](product/design.md)                                                                 |
| 更新管理画面（microCMS）の設定とお客様向けの操作説明 | [product/cms-guide.md](product/cms-guide.md) |
| 検査している項目（納品の条件）と、検査で見つかった不具合                                 | [spec.md](spec.md)                                                                                     |
| 技術的な判断と、その記録（ADR）                                                          | [architecture/README.md](architecture/README.md)                                                       |
| 公開前にやること・顧客サイトの作り方・デプロイ                                           | [operations.md](operations.md)                                                                         |
| セキュリティ対策・検証範囲・配備時の注意                                                 | [architecture/0055-security-hardening.md](architecture/0055-security-hardening.md)                     |
| 自社サイトの公開承認と未確認事項の扱い                                                   | [architecture/0056-owner-authorized-publication.md](architecture/0056-owner-authorized-publication.md) |
| 問い合わせ情報の所在・保持期限・削除の手順                                               | [inquiry-data.md](inquiry-data.md)                                                                     |
| Python／Astro から Next.js への移行                                                      | [history/2026-09-migration.md](history/2026-09-migration.md)                                           |
| コードを触るとき（コマンド・書き方・置き場所の決まり）                                   | [../docs/development.md](development.md)                                                               |

- [2026-09-18 機能・運用の不足監査（34 項目・41 Issue の対応）](product/feature-audit-2026-09-18.md)

---

## なぜこの形にしたか

設計書の最大のリスクは、**20項目の標準仕様が文書のまま運用されないこと**でした。
そこで仕様を実行可能な検証スクリプト（`verify`）にして、**FAILが1件でもあれば納品しない**
というゲートにしています。`/spec` ページに載せている実測値は、この検証が出した数字です。

もうひとつの狙いは工数です。ベーシック6ページ198,000円が成立するのは
**5人日で作れるようになってから**なので、1号目から共通部分を資産化する必要がありました。
2件目以降は事業設定（`src/content/`）、文言（`src/i18n/`）、表示（`src/views/`）を差し替えるだけで、実装はほぼ再利用できます。

---

## 文書の置き場所の決まり

- **事業の規範は `business/` が正本。** `product/` には、それをこのサイトでどう表現し、どう検査しているかを書く
- **コードと一緒に変わるもの（コマンド・書き方・置き場所）は [docs/development.md](development.md)。** 理由や経緯のように、コードに書けないものを `docs/` に置く
- **決めたことは `architecture/` に ADR として残す。** 決定を覆すときも古い記録は消さず、新しい番号を足す
- **いまの状態と残課題は [status.md](status.md) だけに書く。** 作業を終えたら更新する。ほかの文書には書かず、リンクする
- **引き継ぎの入口はリポジトリ直下の [AGENTS.md](../AGENTS.md)。** 崩してはいけないこと・合格ライン・進め方・はまりどころを書く。`CLAUDE.md` はそれを読み込むだけ
- ルートの `AGENTS.md` 末尾にNext.jsが生成するルールを統合する。`CLAUDE.md` はその参照だけを持つ
- 文中のコードのパスは リポジトリルートからの相対
