# 社内ツール（tools/ops）

顧客対応・営業・運用のための CLI。公開サイト（`out/`）とは別で、サイトからは読み込まない。
判断の理由は [ADR 0036](../../docs/architecture/0036-internal-ops-tools-and-estimates.md)。

## 実データの扱い

- **このリポジトリは Public。顧客・見込み客・売上の実データをコミットしない。**
- 実データの既定の置き場所は `.data/`（git 管理外）。`--data <dir>` か `TSUMUGI_DATA_DIR` で変えられるが、リポジトリ内では `.data/`・`.artifacts/` 以外への書き込みを拒否する。
- `tools/ops/fixtures/` には架空のサンプルだけを置く。
- ツールは外部 API を呼ばず、メール・投稿などの送信もしない。

## 見積もり（`npm run ops:estimate`）

金額はすべて `src/content/prices.ts` から計算する。条件を JSON で書いて渡す（例：[fixtures/estimate-basic.json](fixtures/estimate-basic.json)）。

```sh
npm run --silent ops:estimate -- quote  --input tools/ops/fixtures/estimate-basic.json   # 計算だけ（JSON）
npm run --silent ops:estimate -- save   --input <条件.json> [--note <メモ>]              # 新しい版として保存
npm run --silent ops:estimate -- diff   --id <見積番号> --from 1 --to 2                 # 版の差額
npm run --silent ops:estimate -- render --id <見積番号> --format md|html [--version N] [--out <file>]
```

| 入力                          | 内容                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `production`                  | `single`・`basic`・`standard`、または `null`（制作なし）。受付準備中のプランは保存できない |
| `options`                     | `[{ "key": "page_add", "quantity": 2 }]`。キーは `prices.ts` の `OPTIONS`                  |
| `support` / `months`          | 継続支援のキー（`run_self` など）と期間（0〜120 か月）                                     |
| `payment`                     | `deposit_acceptance`（着手時・検収時）だけ                                                 |
| `issuedOn` / `validUntil`     | 発行日と有効期限                                                                           |
| `assumptions` / `unconfirmed` | 前提条件と未確定の事項。書面にそのまま載せる                                               |

- 金額の各行は「確定」「目安（別見積もり）」「仮置き」のどれかを持つ。外部費は常に仮置き。
- 消費税は請求の回ごとに計算する（合計に一度掛けた額と 1 円ずれることがある）。
- 書面は保存した版の金額のまま出す。保存後に料金表が変わっていれば、出力時に注意を出す。
- 印刷用 HTML は JavaScript を含まない。PDF はブラウザの印刷で作る。
