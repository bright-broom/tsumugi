# 運用 ── 公開・顧客サイト・デプロイ

> 文中のコードのパス（`src/…` `tools/scripts/…` `tools/verify/` `src/styles/` `public/` `out/`）は リポジトリルートからの相対。

---

## 公開前にやること

1. `src/content/config.ts` の `PLACEHOLDER = false` にする（ページ上部の「準備中」の帯が消えます）
2. `src/content/config.ts` の `DOMAIN` と、`src/i18n/locales/ja/config.ts` の地域・電話番号・メール・郵便番号・住所・2人のプロフィールを実際の値に
3. 受付サービス（`services/inquiry/`）を配備し、その URL を `FORM_ENDPOINT` に設定する。配備先・保存先・通知手段は未決（[ADR 0035](architecture/0035-inquiry-hosting-candidates.md)）
   （**通知はメールとLINE（またはSMS）の2系統**。受付サービスは2系統の設定でないと起動しない。
   「問い合わせに気づかない」が最大の失注要因です。保持期限と削除の手順は [inquiry-data.md](inquiry-data.md)）
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

## 残っている宿題

[status.md](status.md) の「残課題」にまとめてある（課題の一覧は1か所だけに持つ）。

プレビューと Git 配備は測定レポートをアップロードしないため、`works.html` の検査件数は未計測表示（「—」）となる。公開時に数値を載せる場合は、そのビルドに対応する全項目の実測レポートを作成する。
