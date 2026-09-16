# 0055 — 静的サイト・問い合わせ・社内データ・配備経路を防御する

日付：2026-09-17。状態：採用。依存の追加なし。

## 対象と根拠

ユーザーのサイト全体のセキュリティ強化依頼に対し、公開 URL のレスポンス、Vercel 設定、出力 HTML/SVG、問い合わせサービス、社内 CLI、依存関係、GitHub の設定とワークフローを確認した。公開サイトは静的で、メールへのリンクが連絡手段。`services/inquiry/` は未配備であり、保存・認証・通知の本番アダプタは今回も接続しない。

| 対象 | 確認した問題 | 対策 |
|---|---|---|
| 公開レスポンス | HSTS は Vercel が付与するが、CSP・フレーム拒否・MIME 判定抑止がない | 全パスに CSP、nosniff、DENY、Referrer/Permissions Policy、COOP/CORP を設定 |
| HTML 出力 | JSON-LD の値に HTML 終了タグが混入した場合のエスケープがない | JSON-LD 専用のシリアライズで `<` を Unicode エスケープ |
| 問い合わせ | Origin 未指定/null を許可し、設定省略時は照合しない | 既定をサイトの origin にし、不明な origin を拒否。再入力用の受付先自身の origin も許可 |
| 問い合わせ | 重複パラメーターを先頭値で処理し、本文読取・回数制限障害が未処理 | 重複/読取失敗は 400、制限基盤障害は保存せず 503。回数制限の上限超過は従来どおり 429 |
| 社内ファイル | デフォルト umask 依存の権限、追跡対象を指す symlink、`..` 接頭辞のパス判定 | 新規ディレクトリ 0700・ファイル 0600、実パスで保存先検査、一時ファイルは乱数名＋排他作成＋後始末 |
| CSV | 改行や空白で始まる数式の保護が不足 | 改行・空白に続く式も文字列として出力。数値セルは数値を維持 |
| 配備/CI | 公開ファイルに対する能動コンテンツの検査が不足 | parse5 でイベント属性・危険な URL・不正 script・埋め込み等を検査。公開ファイルの種別、隠しファイル、symlink も検査 |
| GitHub Actions | CI の checkout に認証が残る、成果物 action が可変タグ参照 | credentials を保持しない・ジョブ時間制限・action を確認済み SHA に固定 |
| 継続検査 | 通常 CI で依存の脆弱性判定がない | moderate 以上で失敗する npm audit、週次 audit、Chromium による CSP の動作検証を追加 |

## CSP と互換性

設定の正本は `vercel.json`。既定拒否、スクリプト実行なし、外部通信なし、iframe/object なし、埋め込み拒否、base 要素なし、フォーム送信なし。画像は同一サイトと data、CSS とフォントは同一サイトだけを許可する。静的な JSON-LD は維持する。

既存の料金グラフは金額から計算した CSS 変数を style 属性で渡す。そのため **style-src-attr だけ unsafe-inline を許可**し、ビルド検査では数値の `--comparison-width` と `--table-min-width` 以外を拒否する。style 要素、外部 CSS、JavaScript の unsafe-inline/unsafe-eval は許可しない。CSS 変数を使う他の部品を追加するときは検査と方針を同時に見直す。

`form-action 'none'` は現在のメール受付サイト用。顧客向けフォームを有効にする場合は、確認済みの送信先を CSP へ明示し、受付先の Origin 設定・回数制限・認証・保存・通知まで検証する。CSP だけを広く緩めない。

ローカルの `verify` も同じヘッダーを適用する。開発用の Next.js ホットリロードには本番 CSP を適用しない。新しい `test:security-browser` は実行時 JS を有効にした Chromium で全ページを開き、CSP 違反がないこと、不正スクリプト/イベント/iframe/form が拒否されることを検査する。これは Vercel の実レスポンスを確認した結果ではない。

## GitHub の実設定（変更後に API で再確認）

- Secret scanning と push protection は既に有効。公開されている未解決の secret scanning alert は確認時点で 0 件。
- 無効だった vulnerability alerts と Dependabot security updates を有効化。自動マージは有効にしない。
- `main` は保護なし・適用中 ruleset なしだった。PR と最新ベースでの `validate` 成功を必須にし、GitHub Actions の app ID 15368 に結果の発行元を限定。管理者にも適用し、強制 push と削除を禁止、未解決の会話がある状態でのマージを禁止した。
- オーナーが自分の PR を扱えるよう、他人の承認人数は必須にしていない。PR 必須と第三者レビュー必須を混同しない。

## 検証と限界

- npm audit：全依存で既知の脆弱性 0 件（確認時点）。検出されない問題まで不存在と証明するものではない。
- 追跡ファイルの代表的な秘密鍵・GitHub/AWS/Google キー形式を限定走査し、該当 0。全形式・Git 履歴全体を対象とする秘密情報監査ではない。値自体をログへ出さない。
- 型・lint・Vitest 507 件・価格モデル 12 件・21 ページのビルド・公開出力 50 ファイルの安全性検査が成功。
- CSP 適用下の全項目 verify：PASS 575 / WARN 1 / FAIL 0。Chromium の実ブラウザで、全 21 ページに CSP 違反なし、意図的に埋めた 4 種の攻撃が遮断されることを確認。
- 既存の本番公開条件は維持。サイトの保護ヘッダーは、本番にこの設定を配備して実レスポンスを確認するまでは本番有効と扱わない。
- 未配備の受付は共有レート制限、信頼できる接続元 IP、認証済みの担当者 ID、保存暗号化、通知先、保持期限ジョブを配備先で接続する必要がある。Origin はブラウザからのクロスサイト送信を制限するもので、bot の認証ではない。
- 社内ファイルの対策は新規/更新ファイルを対象とする。既存の外部保存先の権限や、OS アカウント侵害・同一ユーザーの競合攻撃・バックアップ先・GitHub/Vercel アカウントの MFA は別途確認が必要。

## 参照した一次資料

- [Vercel の設定](https://vercel.com/docs/project-configuration/vercel-json)：静的ファイルを含む headers 設定。
- [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)：各ディレクティブの適用範囲。
- [GitHub REST / repositories](https://docs.github.com/en/rest/repos/repos)：vulnerability alerts と自動セキュリティ修正の設定。
