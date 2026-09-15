# 運用 ── 公開・顧客サイト・デプロイ

> 文中のコードのパス（`src/…` `tools/scripts/…` `tools/verify/` `src/styles/` `public/` `out/`）は リポジトリルートからの相対。

---

## 公開前にやること

1. `src/content/config.ts` の `PLACEHOLDER = false` にする（ページ上部の「準備中」の帯が消えます）
2. `src/content/config.ts` の `DOMAIN` と、`src/i18n/locales/ja/config.ts` の地域・電話番号・メール・郵便番号・住所・2人のプロフィールを実際の値に
3. `FORM_ENDPOINT` に問い合わせフォームの送信先を設定する
   （**設定と同時に、通知をメールとLINE（またはSMS）の2系統に分けること**。
   「問い合わせに気づかない」が最大の失注要因です）
4. `LINE_URL` を設定する（未設定ならLINE導線は自動的に出ません）
5. `npm run build && npm run verify` を実行して **FAIL 0 を確認する**
6. `out/` をそのまま公開（Cloudflare Pages / Netlify / Vercel / S3 いずれでも動きます）

`PLACEHOLDER = false` にすると、`verify` は `example.jp` や `0000` といった
**仮の値が残っていないかを検査してFAILにします。**

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

| 項目 | 値 | 確認日 | 確認者 |
|---|---|---|---|
| 本番ドメイン |  |  |  |
| 名義人（登録者） |  |  |  |
| レジストラ・自動更新の有無 |  |  |  |
| ドメインの有効期限 |  |  |  |
| DNS の管理先 |  |  |  |
| 変更前の DNS レコード |  |  |  |
| Vercel のチーム・プロジェクト |  |  |  |
| Vercel の契約プラン |  |  |  |
| 正とするホスト（www の有無）と転送 |  |  |  |
| 証明書の発行を確認した日 |  |  |  |
| GitHub の `SITE_URL` を設定した日 |  |  |  |
| Search Console の登録・sitemap 送信 |  |  |  |

### 公開承認の記録

| 日付 | 承認者 | 対象コミット | validate / verify | リハーサル（`--dist out`） | Preview の確認 | 公開後の `check:live` | 備考 |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |

---

## 残っている宿題

[status.md](status.md) の「残課題」にまとめてある（課題の一覧は1か所だけに持つ）。

プレビューと Git 配備は測定レポートをアップロードしないため、`works.html` の検査件数は未計測表示（「—」）となる。公開時に数値を載せる場合は、そのビルドに対応する全項目の実測レポートを作成する。
