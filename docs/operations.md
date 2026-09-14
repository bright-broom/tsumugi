# 運用 ── 公開・顧客サイト・デプロイ

> 文中のコードのパス（`src/…` `scripts/…` `verify/` `styles/` `public/` `out/`）は `site/` からの相対。

---

## 公開前にやること

1. `src/content/config.ts` の `PLACEHOLDER = false` にする（ページ上部の「準備中」の帯が消えます）
2. `AREA` / `DOMAIN` / `TEL` / `EMAIL` / 住所 / 2人のプロフィールを実際の値に
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
# src/content/config.ts と src/pages/ のページ本文を差し替える
npm install && npm run build && npm run verify
```

顧客サイトでは実写を使うので、次の2点が効いてきます。

- **先頭画像に `loading="lazy"` を付けない**（付けるとLCPが逆に遅くなる。`verify` がFAILにします）
- **先頭画像に `fetchpriority="high"` を付ける**（WARNで検出）

写真が主役のお店のサイトは構造的にLCPで落ちます。
納品前に `verify` を通して、2.5秒以内を確認してから渡してください。

---

## Vercel に載せるとき

- 静的出力（`out/`）なので **Hobby でも足りる。** Framework Preset は Next.js のままでよい
- **公開URLは独自ドメインにする。** `◯◯.vercel.app` のまま渡すと、
  全プランに書いた「独自ドメイン取得（初日からお客様の名義）」が守れない。
  vercel.app は公開前の確認用に使う
- 顧客ごとに顧客名義の Vercel アカウントへ。**土地も顧客のもの**にしておく
- `out/` はそのまま Cloudflare Pages / Netlify / S3 にも置ける（③地盤の主張どおり）

---

## 残っている宿題

| 項目 | 内容 |
|---|---|
| **原書体の契約** | 欧文ディスプレイは無料代替の League Gothic で、原サイトの Manuka Condensed とは字形が異なります。契約して差し替える場合は `--nah-ratio-display-correction` を 1 に戻して再計測すること |
| **LCPの実測条件** | 外部読み込みが 0 になったため、遮断なしで 0.30 秒。公開後にSearch Consoleの実データで再確認すること |
| **問い合わせフォームの送信先** | 未設定。設定と同時に通知の二重化を行う |
| **制作事例** | まだ0件。1号案件の実測値（LCP・GBP閲覧数・問い合わせ件数）を `works.html` に入れる |
| **返答時間の実績** | `src/content/config.ts` の `RESPONSE_ACTUAL`。計測を始めてから書く（測っていない数字は書かない） |
| **CIへの組み込み** | `npm run verify -- --static` を pre-commit か GitHub Actions に入れる。ブラウザ検証は納品前に手動で回す |
| **`terms.html` の弁護士確認** | いまの文面は契約書の下書きです。`PLACEHOLDER=True` のあいだは「弁護士確認前」の注意書きが自動で出ます。確認後に文面を確定し、フリーランス法第4条（書面交付義務）への対応も同時に見てもらうこと |
| **`legal.html` の事業者情報** | 販売事業者名・運営責任者・所在地が仮の値。開業届／登記が済んだら `src/content/config.ts` を差し替える |
