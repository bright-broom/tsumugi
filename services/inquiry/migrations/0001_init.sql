-- 受付サービスの保存先（Cloudflare D1 / SQLite、ADR 0079）。
-- 受付記録は JSON で保持し、重複判定・排他に使う列だけを別に持つ。
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  received_at TEXT NOT NULL,
  version INTEGER NOT NULL,
  record TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inquiries_fingerprint ON inquiries (fingerprint, received_at);
CREATE INDEX IF NOT EXISTS inquiries_received ON inquiries (received_at, id);

-- 閲覧・変更・削除の履歴。追記だけを行い、アプリから更新・削除しない。
CREATE TABLE IF NOT EXISTS access_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  outcome TEXT NOT NULL,
  detail TEXT
);

-- 送信回数の制限（固定窓）。鍵は接続元のハッシュで、IP アドレスそのものは持たない。
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
