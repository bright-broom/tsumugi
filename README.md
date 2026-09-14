# 紬（つむぎ）サービスサイト

小規模事業者向けホームページ制作の自社サイト。
**実行時 JavaScript 0バイト**が製品の主張そのものなので、そこを崩す変更はしない。

**開発を引き継ぐとき（人・AI）は、まず [AGENTS.md](AGENTS.md) と [docs/status.md](docs/status.md) を読む。**

## 中身

| | |
|---|---|
| `site/` | **サイト本体。** Next.js 16（Pages Router）+ React 19 + TypeScript。21ページを静的HTMLに書き出す。コードを触るときは [site/README.md](site/README.md) |
| `site/verify/` | **検査。製品の一部。** 581項目。1つでも落ちたら納品しない |
| `docs/` | **理由と経緯。** 事業の規範・サイトの主張と値付け・デザイン・検査項目・技術の判断（ADR）・運用・移行の記録。目次は [docs/README.md](docs/README.md) |

## 動かす

```bash
cd site
npm install
npx playwright install chromium   # 検査に使う（初回だけ）
npm run dev       # http://localhost:3000
npm run build     # → out/
npm run verify    # PASS 581 / WARN 1 / FAIL 0 なら納品可
```

WARN 1 は `PLACEHOLDER=true`（電話番号・住所が仮）。公開前に潰す既知の1件（[公開前にやること](docs/operations.md)）。
