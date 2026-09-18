# 運用 ── 公開・顧客サイト・デプロイ

> 自社サイトの公開：2026-09-17 のオーナー指示により [ADR 0056](architecture/0056-owner-authorized-publication.md) を適用。専門家確認・受入確認の未実施分は WARN に残す。顧客テンプレートでは `OWNER_PUBLICATION=null` に戻し、従来の納品条件を適用する。紬は Vercel URL・メール受付で公開し、独自ドメインやフォームの導入を前提にしない。

> 文中のコードのパス（`src/…` `tools/scripts/…` `tools/verify/` `src/styles/` `public/` `out/`）は リポジトリルートからの相対。

---

## 公開前にやること

1. `src/content/config.ts` の `PLACEHOLDER = false` にする（ページ上部の「準備中」の帯が消えます）
2. `src/content/config.ts` の `DOMAIN` と、`src/i18n/locales/ja/config.ts` の地域・電話番号・メール・郵便番号・住所・2人のプロフィールを実際の値に
3. 受付サービス（`services/inquiry/`）を配備し、その URL を `FORM_ENDPOINT` に設定する。配備先・保存先・通知手段は未決（[ADR 0035](architecture/0035-inquiry-hosting-candidates.md)）
   （**通知はメールとLINE（またはSMS）の2系統**。受付サービスは2系統の設定でないと起動しない。
   「問い合わせに気づかない」が最大の失注要因です。保持期限と削除の手順は [inquiry-data.md](inquiry-data.md)）
4. `LINE_URL` を設定する（未設定ならLINE導線は自動的に出ません）
5. 契約文面（`terms`）と事業者表示（`legal`）の確認を受けたら、`src/content/config.ts` の `LEGAL_APPROVALS` に版・承認日・確認者の役割・文面の SHA-256 を記録する（SHA-256 は次の本番モードの検査の詳細に出る。推測で埋めない）
6. 仕様20項目のうち人の確認・外部接続の確認が必要な項目（Googleビジネスプロフィール・通知2系統など）を確かめ、`src/content/acceptance.ts` に根拠の置き場所と一緒に記録する
7. `npm run build && npm run verify -- --mode production` を実行して **FAIL 0 を確認する**
8. `out/` をそのまま公開（Cloudflare Pages / Netlify / Vercel / S3 いずれでも動きます）

本番モードは、`PLACEHOLDER=true`、`example.jp`・`000-0000-0000`・「（名前）」「（都道府県）」などの仮の値、空の `FORM_ENDPOINT`、承認記録と人の確認記録の不足を**条件ごとに FAIL にします**。
既定のプレビューモードは仮の設定でも通し、不足を WARN 1 件にまとめます（`PLACEHOLDER = false` で仮の値が残っていればプレビューでも FAIL）。詳細は [ADR 0024](architecture/0024-publication-gates.md)。

---

## 顧客サイトを作るとき

```
cp -r site ../clients/<顧客名>   # node_modules / .next / out は除く
# src/content/config.ts と src/i18n/locales/ja/ の文言（構造は src/views/、ルートは src/routing/registry.ts）を差し替える
npm ci && npm run validate && npm run verify
```

顧客サイトでは実写を使うので、次の2点が効いてきます。

- **先頭画像に `loading="lazy"` を付けない**（付けるとLCPが逆に遅くなる。`verify` がFAILにします）
- **先頭画像に `fetchpriority="high"` を付ける**（WARNで検出）

写真が主役のお店のサイトは構造的にLCPで落ちます。
納品前に `verify` を通して、2.5秒以内を確認してから渡してください。

---

## Vercel に載せるとき

- Vercel プロジェクトの Root Directory を未指定（リポジトリルート）にする。Node.js は 24 系。
- `vercel.json` に install=`npx --yes npm@12.0.2 ci`、build=`npm run validate`、output=`out`、Framework Preset=`Other` を保存してある。Next.js の静的生成を使い、検証済みの出力をそのまま配信する。
- Vercel の本番配備（`VERCEL_ENV=production`：本番ブランチの Git 配備と `vercel --prod`）では、`npm run validate` の中の `verify -- --static` が自動で本番モードになり、公開条件を満たすまで配備が失敗する。プレビュー配備はプレビューモードのまま（[ADR 0024](architecture/0024-publication-gates.md)）。
- 初回はリポジトリ直下で `node_modules/.bin/vercel link` を実行してプロジェクトへ接続し、`npm run deploy:preview` で確認する。本番は事業者情報などの公開条件を満たしてから `npm run deploy:production`。
- 商用利用のプランは契約条件に従う。[Hobby は個人の非商用向け](https://vercel.com/docs/plans/hobby)なので、「静的だから Hobby でよい」とは判断しない。
- Vercel の初回配備は指定にかかわらず Production として扱われることがある。新規案件では認証保護とドメイン割り当てを確認する。紬では初回の自動 Production 配備を削除し、Preview に切り替えて検証した。
- **公開URLは独自ドメインにする。** `◯◯.vercel.app` のまま渡すと、
  全プランに書いた「独自ドメイン取得（初日からお客様の名義）」が守れない。
  vercel.app は公開前の確認用に使う
- 顧客ごとに顧客名義の Vercel アカウントへ。**土地も顧客のもの**にしておく
- `out/` はそのまま Cloudflare Pages / Netlify / S3 にも置ける（③地盤の主張どおり）

---

## 独自ドメインで本番公開する

ドメイン・DNS・Vercel は**名義人のアカウントで行う外部作業**。リポジトリの作業者は代行しない。判断の記録は [ADR 0044](architecture/0044-live-domain-checks.md)。

### 1. 名義と契約を確かめる

- ドメインは**サービスを受ける事業者の名義**で取得する（紬の自社サイトは紬の事業者名義、顧客サイトは顧客名義）。レジストラのアカウントも名義人が持ち、紬はログイン情報を預からない。
- 登録者名・管理用メールアドレスが名義人のものか、自動更新と支払い方法が名義人のものかを、レジストラの画面で確認する。
- Vercel のプロジェクトとチーム・契約プランが商用利用の条件を満たすか確認する（Hobby は個人の非商用向け）。
- 結果は下の「外部設定の記録」に書く。

### 2. 公開前の検査と承認

1. `src/content/config.ts` の `DOMAIN` を本番ドメインにし、公開条件（`PLACEHOLDER = false` など、「公開前にやること」）を満たす。canonical・OGP・sitemap・robots はビルド時の `DOMAIN` から作られるので、**差し替えてからビルドする**
2. `npm run validate` と `npm run verify` が FAIL 0
3. `npm run build` のあと `npm run check:live -- --url https://<本番ドメイン> --dist out` を実行する。通信せずに `out/` を読み、canonical・og:url・sitemap・robots・404・実行時 JS を本番ドメインの前提で確かめる（DNS・証明書・HTTP 転送は SKIP）。FAIL 0
4. Preview 配備（`npm run deploy:preview`、オーナーの端末）で表示を確認する
5. 公開の承認を「公開承認の記録」に書く。承認前に Production へ配備しない

### 3. Vercel に独自ドメインを設定する

1. **変更前の DNS レコードを控える**（切り戻しに使う）
2. Vercel のプロジェクト → Settings → Domains で本番ドメインを追加する。`www` 付きとなしのどちらを正にするかを決め、もう一方は正のほうへ転送する（`DOMAIN` と同じほうを正にする）
3. Vercel の画面に表示された DNS レコードを、DNS の管理画面にそのまま設定する。値はプロジェクトごとに画面で確かめ、この文書やほかの案件から写さない
4. Vercel の画面でドメインの検証と証明書の発行が完了したことを確認する
5. 承認済みのコミットを Production に配備する（`npm run deploy:production` か、Git 連携の本番ブランチ）

### 4. 公開後の確認

```bash
npm run check:live -- --url https://<本番ドメイン>
```

- DNS の解決、証明書（残り 21 日未満で WARN、7 日未満で FAIL）、HTTP→HTTPS の恒久転送、トップページ、robots.txt、sitemap.xml と掲載 URL がすべて 200、canonical と og:url がそのドメインの掲載 URL と一致、配信された HTML に実行時 JS がないこと、存在しない URL が 404 になることを確かめる。**FAIL 0 で公開完了。**
- DNS の反映には時間がかかることがある。名前解決と証明書だけが FAIL なら、時間を置いて再実行する。ほかの項目の FAIL は設定か配備を疑う。
- 結果（`.artifacts/ops/check-live.json`）の要点を「公開承認の記録」に書き、`docs/status.md` の「デプロイ」を更新する。
- 続けて [公開後の監視](#公開後の監視) の `SITE_URL` を設定し、Search Console に登録する。

### 5. 切り戻し（直前の配備に戻す）

戻す判断：`check:live` でトップページ・掲載 URL・404・実行時 JS・canonical のいずれかが FAIL、または表示や導線の崩れを確認したとき。

1. **配備が原因のとき**：Vercel のプロジェクト → Deployments で、直前に正常だった Production 配備を選び、Instant Rollback で本番に戻す（端末からは `node_modules/.bin/vercel rollback`）。戻せる範囲はプランによって異なるので画面で確かめる
2. **DNS の変更が原因のとき**：手順 3-1 で控えたレコードに戻す
3. 戻したあと `npm run check:live -- --url https://<本番ドメイン>` を再実行し、結果を記録する
4. 原因の修正は通常どおりブランチとプルリクエストで行う（`git revert` を含む）。ロールバック後は新しい配備が自動では本番に割り当てられない状態になることがあるので、修正版が本番に割り当てられたことを Vercel の画面と `check:live` で確かめる

### 外部設定の記録

確認した日と確認した人を必ず書く。未確認の欄は空欄のまま残す（推測で埋めない）。

| 項目                                | 値  | 確認日 | 確認者 |
| ----------------------------------- | --- | ------ | ------ |
| 本番ドメイン                        |     |        |        |
| 名義人（登録者）                    |     |        |        |
| レジストラ・自動更新の有無          |     |        |        |
| ドメインの有効期限                  |     |        |        |
| DNS の管理先                        |     |        |        |
| 変更前の DNS レコード               |     |        |        |
| Vercel のチーム・プロジェクト       |     |        |        |
| Vercel の契約プラン                 |     |        |        |
| 正とするホスト（www の有無）と転送  |     |        |        |
| 証明書の発行を確認した日            |     |        |        |
| GitHub の `SITE_URL` を設定した日   |     |        |        |
| Search Console の登録・sitemap 送信 |     |        |        |

### 公開承認の記録

| 日付 | 承認者 | 対象コミット | validate / verify | リハーサル（`--dist out`） | Preview の確認 | 公開後の `check:live` | 備考 |
| ---- | ------ | ------------ | ----------------- | -------------------------- | -------------- | --------------------- | ---- |
|      |        |              |                   |                            |                |                       |      |

---

## バックアップと復元

対象・除外・保管先の制約の判断は [ADR 0045](architecture/0045-weekly-backup.md)。

### 何を残すか

| 区分   | 対象                                                             |
| ------ | ---------------------------------------------------------------- |
| ソース | `src/`・`tools/`・`tests/`                                       |
| 素材   | `src/assets/`・`public/`                                         |
| 文書   | `docs/`・ルートの `*.md`                                         |
| 設定   | ルートの設定ファイル・`config/`・`.github/`・`package-lock.json` |
| 履歴   | HEAD までの全コミット                                            |

**残さないもの**：`.env*`（`.env.example` を除く）・`.vercel/`・`node_modules/`・生成物（`out/`・`.next/`・`.artifacts/`・ビルドが書く `public/theme.css` など）。これらが Git に追跡されていたり、秘密鍵やトークンの形の文字列があったりすると、バックアップは作られずに止まる。

**このリポジトリと、その週次の成果物に置いてはいけないもの**：CMS のデータ、問い合わせの内容、顧客の非公開の素材、秘密情報。Public リポジトリの成果物はリポジトリを読める人なら取得できる。これらの保管先はオーナーが別に決める（「保管先の記録」）。

### 週次の自動実行

`.github/workflows/weekly-backup.yml` が毎週月曜 3:23（日本時間）に、バックアップ → 復元テスト（`npm ci` とビルドを含む） → 成果物の保存（90 日）を行う。

- 結果：Actions → Weekly backup の実行一覧。ジョブの要約に各段階の秒数が出る
- 成果物：実行の画面の Artifacts にある `tsumugi-backup-<番号>`（`repo.bundle`・`manifest.json`・`SHA256SUMS`・`restore-report.json`）
- 失敗：GitHub の標準の Actions 失敗通知（cron を最後に変更した人に届く）
- 月次の確認（[手動確認](#手で見るもの月に一度と公開大きな変更の直後)と同じ日）：直近 4 週の実行が成功しているか。止まっていたら Actions の画面で有効に戻す

### 手元で取る・復元を試す

```bash
npm run backup                                   # .artifacts/backup/tsumugi-<日時>-<commit>/
npm run backup:restore-test -- --backup .artifacts/backup/tsumugi-<日時>-<commit>
```

- 未コミットの変更があるとバックアップは作られない。コミットしてから実行する
- 復元先は実行ごとに一時フォルダを作る。内部の `repo` は排他的に確保し、既存フォルダ・ファイル・リンクがあれば失敗する。後片付けはその実行が作った `repo` のみで、`--keep` なら成功・失敗とも保持する（[ADR 0067](architecture/0067-restore-workspace-ownership.md)）。
- 復元テストの既定は `--deps ci --build build`（別環境での復元と同じ条件。依存のダウンロードに通信とディスクが要る）。手元のディスクや通信を節約するときは、`package-lock.json` が同じ場合に限り既存の `node_modules` を使う：`--deps clone`（macOS の APFS クローン。ビルドまで確かめられる）か `--deps link`（シンボリックリンク。Next.js の Turbopack がプロジェクト外を指すリンクを拒否するため `--build typecheck` まで）。どちらも所要時間にインストールを含まないので、その条件を記録に書く
- 独立した保管先に写すときは、ディレクトリごと（3 ファイル）写す。写した先で `shasum -a 256 -c SHA256SUMS` で照合できる

### 復旧の手順（リポジトリを失ったとき）

1. 最新の成功したバックアップ（成果物か独立した保管先の写し）を取り出し、`shasum -a 256 -c SHA256SUMS` で照合する
2. `npm run backup:restore-test -- --backup <dir> --keep` で復元と照合・ビルドまでを行い、表示された復元先を使う（または `git clone repo.bundle <dir>` で取り出し、`manifest.json` の `commit` を checkout する）
3. 新しいリモートリポジトリを作り、復元したリポジトリを push する。Vercel・GitHub の設定（`SITE_URL`、Dependabot、ブランチの保護）はリポジトリに含まれないので、「外部設定の記録」を見て設定し直す
4. `npm run validate && npm run verify` を通し、配備後に `npm run check:live` を実行する

### 復元テストの記録

| 日付               | 実行者・場所                                 | バックアップ（commit） | 条件（deps・build） | 結果 | 所要時間（合計）                       | 備考                                                                                                                                                                              |
| ------------------ | -------------------------------------------- | ---------------------- | ------------------- | ---- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-18         | 作業エージェント・同じ Mac の別ディレクトリ  | `7c6dedb`              | ci・build           | 成功 | 18.215 秒（依存 7.575・ビルド 10.380） | 458 ファイルのハッシュ一致・145 コミット・22 HTML。npm 12.0.2、元の node_modules は不使用。独立端末・保管先の検証ではない。証跡 `.artifacts/restore-safety/restore-report.json`。 |
| 2026-09-16         | 作業エージェント・作業用の Mac（macOS 15.8） | `5d88646`              | clone・build        | 成功 | 15.6 秒（依存の複製 7.6・ビルド 7.6）  | インストール時間を含まない。内訳は [ADR 0045](architecture/0045-weekly-backup.md#復元テストの実測)                                                                                |
| 2026-09-16         | 作業エージェント・作業用の Mac（macOS 15.8） | `5d88646`              | link・typecheck     | 成功 | 1.0 秒                                 | `link` と `build` の組み合わせは Turbopack が拒否（開始前にエラーにした）                                                                                                         |
| （初回の週次実行） | GitHub Actions                               |                        | ci・build           |      |                                        | `npm ci` を含む所要時間をここに書く                                                                                                                                               |

### 保管先の記録

| データ                                 | 保管先                       | 公開の有無・暗号化                  | 保持期間 | 決めた日・決めた人         |
| -------------------------------------- | ---------------------------- | ----------------------------------- | -------- | -------------------------- |
| リポジトリ（ソース・素材・文書・設定） | GitHub の週次成果物（90 日） | 公開（Public リポジトリと同じ内容） | 90 日    | 2026-09-16（ADR 0045、仮） |
| リポジトリの独立した写し               |                              |                                     |          |                            |
| CMS のデータ                           |                              |                                     |          |                            |
| 問い合わせのデータ                     |                              |                                     |          |                            |
| 顧客の非公開の素材                     |                              |                                     |          |                            |

---

## 公開後の監視

監視の現在の設計は [ADR 0064](architecture/0064-production-monitoring.md)。通知の限界は [ADR 0046](architecture/0046-post-launch-monitoring.md)。

### 設定（公開後に一度）

1. GitHub のリポジトリ → Settings → Secrets and variables → Actions → **Variables** に `SITE_URL` を追加する。値は `https://<本番ドメイン>`（末尾の `/` やパスは付けない）。公開情報なので Secret にしない
2. Actions → Site monitor → Run workflow で一度手動実行し、ジョブの要約に結果の表が出ることを確かめる
3. 失敗通知を受け取る人が、GitHub の通知設定で Actions の失敗通知を受け取る設定になっているか確かめる。**定期実行の失敗通知は、ワークフローの cron を最後に変更した人に届く**
4. 「監視の体制」の表を埋める

`SITE_URL` が未設定でも、紬の自社公開判断に一致する `DOMAIN`（`PLACEHOLDER=false`）を監視する。顧客テンプレート等で公開先を確定できなければ終了コード 2 で失敗する。未実行を成功とは扱わない。期待するページと連絡先は、この checkout の設定から取得するので、監視先も同じ顧客サイトに揃える。

### 自動で見るもの（毎時）

`npm run monitor -- --url https://<本番ドメイン>` と同じ内容。手元でも実行できる。

| 項目                         | WARN                     | FAIL                                                                   |
| ---------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| 死活（トップページ）         | —                        | 200 でない・接続できない                                               |
| 証明書の残り日数             | 21 日未満                | 7 日未満・検証できない                                                 |
| robots.txt                   | —                        | 取得できない・全体の拒否・Sitemap の不一致                             |
| sitemap.xml と期待する URL   | —                        | 取得できない・重複・コードの公開一覧との不一致・期待 URL が 200 でない |
| DNS・HTTP から HTTPS         | 一時転送                 | 名前解決・恒久転送の不備                                               |
| canonical・og:url・実行時 JS | —                        | 配信 URL と不一致・実行時 JS の混入                                    |
| 検索除外                     | —                        | 公開ページの robots meta または X-Robots-Tag に noindex / none         |
| 問い合わせ導線               | —                        | 設定済みの電話・メールリンクが問い合わせページにない（実送受信は別途） |
| 不存在 URL                   | —                        | 404 にならない                                                         |
| 応答時間                     | 3,000ms 超のページがある | —                                                                      |

監視 JSON はジョブ要約に加えて Actions の成果物へ 14 日保存する。設定・依存導入で止まった場合はログで理由を確認する。`--dist out` なら通信せずに同じ検査を試せる（DNS・証明書・HTTPS 転送は SKIP）。

### 手で見るもの（月に一度と、公開・大きな変更の直後）

オーナーの Google アカウント・レジストラのアカウントが必要で、自動化していない。

1. **Search Console**：ドメインプロパティを追加し、DNS の TXT レコードで所有を確認する（サイトの HTML に確認用タグを足さない）。サイトマップに `https://<本番ドメイン>/sitemap.xml` を送信する
2. インデックス登録（ページ）のレポートでエラーと除外の理由を見る。サイトマップの状態が「成功」か見る
3. ウェブに関する主な指標のレポートで実データを見る。アクセスが少ないうちは「データ不足」で表示されない
4. セキュリティと手動による対策に問題がないか見る
5. レジストラでドメインの有効期限と自動更新を見る（監視コマンドはドメインの期限を見ない）
6. Actions の Site monitor に直近の実行が並んでいるか見る（定期実行が止まっていないか）
7. 「手動確認の記録」に書く

### 手元の計測と公開後の実測

|                | 手元の計測                                                                                            | 公開後の実測                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 出所           | `npm run verify` の Chromium 計測。`--write` で `src/content/measurements.ts` の `LCP_SECONDS` に書く | Search Console のウェブに関する主な指標、PageSpeed Insights の実ユーザーのデータ（Chrome UX Report） |
| 条件           | 作業した端末・ローカル配信・回線の遅延なし                                                            | 実際の利用者の端末と回線。一定期間の集計                                                             |
| サイトへの掲載 | 計測条件を添えて掲載している                                                                          | 取得できてから、出所を分けて書く。取得前に実測値として書かない                                       |

監視の「応答時間」は GitHub の実行環境からの取得時間で、どちらの代わりにもならない（障害の兆候を見るためだけに使う）。

### 監視が失敗したときの確認手順

1. Actions の失敗した実行を開き、ジョブの要約の表で FAIL の項目と内容を見る
2. 手元で `npm run monitor -- --url https://<本番ドメイン>` を実行する。手元では合格する場合は、Run workflow で再実行する。**2 回続けて失敗したら障害として扱う**
3. 項目ごとに確かめる
   - **死活・掲載 URL が 5xx・接続できない**：Vercel の Deployments で本番配備の状態を見る。直前の配備が原因なら [切り戻し](#5-切り戻し直前の配備に戻す) を行う
   - **名前解決できない（ENOTFOUND など）**：レジストラでドメインの期限切れ・DNS の変更がないか、「外部設定の記録」の値と比べる
   - **証明書の WARN・FAIL**：Vercel の Domains で証明書の状態を見る。DNS が Vercel を指したままか確かめる
   - **robots・sitemap の FAIL**：本番に出ているコミットの `DOMAIN` とビルドを確かめ、`npm run check:live -- --url https://<本番ドメイン>` で全体を確認する
   - **応答時間の WARN だけ**：1 回だけなら記録して様子を見る。続く場合は手元の回線から `check:live` で比べる
4. 復旧したら `npm run check:live` を実行し、「障害と復旧の記録」に書く
5. **監視そのものが止まったとき**（Actions に数時間分の実行がない）：Actions の画面でワークフローが無効になっていないか見て、有効に戻す。Public リポジトリは動きがない期間が続くと定期実行が止まる

### 監視の体制

| 項目                                                            | 値  | 決めた日 |
| --------------------------------------------------------------- | --- | -------- |
| 監視の担当者                                                    |     |          |
| 失敗通知を受け取る GitHub アカウント（cron を最後に変更した人） |     |          |
| 2 人目への連絡方法                                              |     |          |
| 顧客サイトで監視を提供する場合の通知先・方式                    |     |          |

### 手動確認の記録

| 日付 | 確認者 | Search Console（登録・エラー） | 実データ（指標） | ドメイン期限 | 定期実行の稼働 | 備考 |
| ---- | ------ | ------------------------------ | ---------------- | ------------ | -------------- | ---- |
|      |        |                                |                  |              |                |      |

### 障害と復旧の記録

| 検知日時 | 検知方法 | 影響 | 原因 | 対応 | 復旧確認（`check:live`） | 記録者 |
| -------- | -------- | ---- | ---- | ---- | ------------------------ | ------ |
|          |          |      |      |      |                          |        |

---

## 残っている宿題

[status.md](status.md) の「残課題」にまとめてある（課題の一覧は1か所だけに持つ）。

Vercel の Git 配備は静的検査だけで全項目のレポートを持たないため、`works.html` の検査件数は「—」（未計測）になる。件数を載せるには、同じコミットのきれいなチェックアウトで build → verify（全項目・FAIL 0）→ build を行い、その `out/` をそのまま配る（[ADR 0025](architecture/0025-verified-build-report.md)）。どの方法で配るかはオーナーが決める。

## 公開成果物の一致確認

`npm run check:release -- --url https://<公開先> --dist <公開に使った成果物>` で、HTML・CSS・画像を含む全ファイルと公開トップをSHA-256で照合する。記録は `.artifacts/ops/check-release.json`。全一致は終了0、不一致やHTTPエラーは1、比較元や入力の問題は2。比較元は公開用ディレクトリを明示し、生成中や中身が変わるディレクトリは使わない。

- 比較元の指紋を固定する場合は `--fingerprint <記録済みのSHA256>`。指紋が異なれば通信前に停止する。
- 公開前の模擬検査は `--served-dist <模擬配信元>` を追加する。この場合は通信せず、結果に「模擬配信」と記す。
- HTTP200と内容一致を要求する。404.html だけは404も許可する。転送は追跡せず、意図した公開先を指定し直す。
- 不一致のパスを確認し、古い版・配信の一部混在・ビルド条件差を切り分ける。コマンドはデプロイ・切戻し・ファイル削除を行わない。
- 同じコミットからの再ビルドでも、実測証跡の有無で works.html が変わることがある。配備に使用した実物と比較し、GitのSHAだけで同一内容とみなさない。
- 配備IDとcommitの対応、余分な公開ファイル、ヘッダー・画面の動作はこの検査だけでは確認できない。check:live・monitorと併用する。[ADR 0068](architecture/0068-release-content-verification.md)。
- 配備の切替を待つ場合は `--wait-seconds 900 --interval-seconds 30` のように指定する。全件一致するまで繰り返し、期限切れは最後の結果をFAILとして記録する。`--url` を省略すると `SITE_URL`、なければ監視と同じ自社公開先を使う。
- GitHub Actions の Release check が、main への push 後（最大15分待つ）と毎日6:41に、main のビルドと本番を照合する。失敗は本番が main と異なるか、取得できなかったことを示す。自動の配備・巻き戻しはしない。[ADR 0076](architecture/0076-release-drift-check.md)。
- プロキシ経由でしか外部へ出られない環境では、Node の fetch は既定でプロキシを使わず全件「fetch failed」になる。`NODE_USE_ENV_PROXY=1` を付けて実行する（Node 24.5以降）。

### 配信ヘッダーの確認

`check:live`と`monitor`はトップ`/`と取得した公開ページの200応答で、`vercel.json`にある7つのセキュリティヘッダーを照合する。欠落・値の変更はFAIL。意図した変更は配備設定と揃え、再検査する。`--dist`の模擬配信はSKIPであり実配信の証明にはならない。資産の404や通知の到達は別途確認する（[ADR0069](architecture/0069-delivered-headers-and-issue-review.md)）。

### CSS・画像だけが欠けた場合の監視

`monitor`と`check:live`は、トップ`/`と公開HTMLが直接参照する同一サイトのCSS・画像・OGP・アイコンへHEADを送り、200応答とContent-Typeを検査する。404・転送・HTMLへの置換・型の欠落・HEAD非対応もFAIL。最大128資産・4並列・各15秒。`--dist`で通信なしのファイル欠落確認もできる。

本文の破損は`check:release`、見た目は`verify`で確認する。CSS内部やSVG内部、srcset/picture、外部資産は対象外。HEADの合格を画像表示・全依存の完全性の証明にしない（[ADR0071](architecture/0071-referenced-asset-monitoring.md)）。
