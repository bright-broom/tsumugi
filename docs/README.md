# ドキュメント

自社のサービスサイトと、顧客に納品するサイトを**同じコードベースで作る**ための一式です。
自社サイトが標準仕様の1号案件になり、そのまま顧客サイトのテンプレート資産になります。

サイトの主張は1つに絞ってあります。**「いまのホームページは借地権、紬がつくるのは所有権」**。
ページの並び・図・章題・OGPの文面は、すべてこの一文を支えるために配置されています
（→ [サイトの主張と値付け](product/messaging-and-pricing.md)）。

デザインは **NOT A HOTEL デザインガイドライン v2.0** に準拠しています（→ [デザイン](product/design.md)）。

| 知りたいこと | 文書 |
|---|---|
| **開発を引き継ぐとき（人・AI）の入口** | [../AGENTS.md](../AGENTS.md) |
| **いまの状態と残課題** | [status.md](status.md) |
| 事業の規範（何を売り、何を売らないか・営業・納品・運用・法令） | [business/紬_ビジネスガイドライン.md](business/紬_ビジネスガイドライン.md) |
| 事業の数字（料金レバー・プラン・補助金・掲載費） | [business/紬_事業の中身.xlsx](business/紬_事業の中身.xlsx) |
| 月140時間で採用した料金体系・提供範囲・採算・検証計画 | [business/pricing-redesign-140h.md](business/pricing-redesign-140h.md) |
| サイトの主張・値付け・約束の置き場所・屋号・数字の出典 | [product/messaging-and-pricing.md](product/messaging-and-pricing.md) |
| 21ページの役割と共通情報の管理 | [product/information-architecture.md](product/information-architecture.md) |
| デザインの出所・スマホ表示・図・共有カード | [product/design.md](product/design.md) |
| 検査している項目（納品の条件）と、検査で見つかった不具合 | [spec.md](spec.md) |
| 技術的な判断と、その記録（ADR） | [architecture/README.md](architecture/README.md) |
| 公開前にやること・顧客サイトの作り方・デプロイ | [operations.md](operations.md) |
| 問い合わせ情報の所在・保持期限・削除の手順 | [inquiry-data.md](inquiry-data.md) |
| Python／Astro から Next.js への移行 | [history/2026-09-migration.md](history/2026-09-migration.md) |
| コードを触るとき（コマンド・書き方・置き場所の決まり） | [../docs/development.md](development.md) |

---

## なぜこの形にしたか

設計書の最大のリスクは、**20項目の標準仕様が文書のまま運用されないこと**でした。
そこで仕様を実行可能な検証スクリプト（`verify`）にして、**FAILが1件でもあれば納品しない**
というゲートにしています。`/spec` ページに載せている実測値は、この検証が出した数字です。

もうひとつの狙いは工数です。ベーシック6ページ198,000円が成立するのは
**5人日で作れるようになってから**なので、1号目から共通部分を資産化する必要がありました。
2件目以降は中身（`src/content/`）とページ本文（`src/pages/`）を差し替えるだけで、実装はほぼ再利用できます。

---

## 文書の置き場所の決まり

- **事業の規範は `business/` が正本。** `product/` には、それをこのサイトでどう表現し、どう検査しているかを書く
- **コードと一緒に変わるもの（コマンド・書き方・置き場所）は [docs/development.md](development.md)。** 理由や経緯のように、コードに書けないものを `docs/` に置く
- **決めたことは `architecture/` に ADR として残す。** 決定を覆すときも古い記録は消さず、新しい番号を足す
- **いまの状態と残課題は [status.md](status.md) だけに書く。** 作業を終えたら更新する。ほかの文書には書かず、リンクする
- **引き継ぎの入口はリポジトリ直下の [AGENTS.md](../AGENTS.md)。** 崩してはいけないこと・合格ライン・進め方・はまりどころを書く。`CLAUDE.md` はそれを読み込むだけ
- ルートの `AGENTS.md` 末尾にNext.jsが生成するルールを統合する。`CLAUDE.md` はその参照だけを持つ
- 文中のコードのパスは リポジトリルートからの相対
