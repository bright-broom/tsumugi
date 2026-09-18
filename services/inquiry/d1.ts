/**
 * Cloudflare D1（SQLite）の保存先・操作履歴・送信回数制限（ADR 0079）。
 * スキーマは migrations/0001_init.sql。受付記録は JSON で持ち、重複判定と排他に使う列だけを別に持つ。
 *
 * - createOrGetRecent は「同じ内容の新しい記録がなければ保存」を 1 文の INSERT ... WHERE NOT EXISTS で行う。
 * - update は version を比べる条件付き UPDATE。ほかの更新が先に入ったら読み直してやり直す。
 * - 送信回数は 1 文の UPSERT ... RETURNING で数え、複数インスタンスでも同じ窓を共有する。
 */
import type { AccessEvent, AccessLog } from './audit';
import type { RateDecision, RateLimiter } from './rate-limit';
import type { InquiryRecord, InquiryStore } from './records';

/** D1 のうち、ここで使う部分だけ。Workers の型パッケージに依存しない。 */
interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  meta: { changes: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Row {
  record: string;
  version: number;
}

const decode = (row: Row): InquiryRecord => ({
  ...(JSON.parse(row.record) as InquiryRecord),
  version: Number(row.version),
});

/** 条件付き更新の再試行回数。超えたら保存せずに失敗させる（呼び出し側が再試行する）。 */
const MAX_UPDATE_ATTEMPTS = 5;

export class D1InquiryStore implements InquiryStore {
  constructor(private readonly db: D1Database) {}

  async createOrGetRecent(record: InquiryRecord, notBefore: Date) {
    const since = notBefore.toISOString();
    const stored = { ...record, version: 1 };
    const inserted = await this.db
      .prepare(
        `INSERT INTO inquiries (id, fingerprint, received_at, version, record)
         SELECT ?1, ?2, ?3, 1, ?4
         WHERE NOT EXISTS (SELECT 1 FROM inquiries WHERE fingerprint = ?2 AND received_at >= ?5)`,
      )
      .bind(record.id, record.fingerprint, record.receivedAt, JSON.stringify(stored), since)
      .run();
    if (inserted.meta.changes === 1) return { record: stored, created: true };
    const recent = await this.db
      .prepare(
        `SELECT record, version FROM inquiries WHERE fingerprint = ?1 AND received_at >= ?2
         ORDER BY received_at, id LIMIT 1`,
      )
      .bind(record.fingerprint, since)
      .first<Row>();
    // 直後に削除された場合など。受け付けたと誤認させないよう失敗にする
    if (!recent) throw new Error('Inquiry was neither stored nor found');
    return { record: decode(recent), created: false };
  }

  async get(id: string) {
    const row = await this.db
      .prepare('SELECT record, version FROM inquiries WHERE id = ?1')
      .bind(id)
      .first<Row>();
    return row ? decode(row) : undefined;
  }

  async update(id: string, change: (current: InquiryRecord) => InquiryRecord | undefined) {
    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt++) {
      const current = await this.get(id);
      if (!current) return undefined;
      const next = change(structuredClone(current));
      if (!next) return current;
      if (next.id !== current.id) throw new Error('Inquiry id cannot change');
      const stored = { ...next, version: current.version + 1 };
      const result = await this.db
        .prepare(
          `UPDATE inquiries SET record = ?1, version = ?2, fingerprint = ?3, received_at = ?4
           WHERE id = ?5 AND version = ?6`,
        )
        .bind(
          JSON.stringify(stored),
          stored.version,
          stored.fingerprint,
          stored.receivedAt,
          id,
          current.version,
        )
        .run();
      if (result.meta.changes === 1) return stored;
    }
    throw new Error(`Inquiry ${id} was changed concurrently; update not saved`);
  }

  async list() {
    const { results = [] } = await this.db
      .prepare('SELECT record, version FROM inquiries ORDER BY received_at, id')
      .all<Row>();
    return results.map(decode);
  }

  async delete(id: string) {
    const result = await this.db.prepare('DELETE FROM inquiries WHERE id = ?1').bind(id).run();
    return result.meta.changes > 0;
  }
}

/** 追記専用の操作履歴。更新・削除の手段を持たない。 */
export class D1AccessLog implements AccessLog {
  constructor(private readonly db: D1Database) {}

  async append(event: AccessEvent) {
    await this.db
      .prepare(
        `INSERT INTO access_log (at, actor_id, permission, action, target, outcome, detail)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(
        event.at,
        event.actorId,
        event.permission,
        event.action,
        event.target,
        event.outcome,
        event.detail,
      )
      .run();
  }

  async list(): Promise<AccessEvent[]> {
    const { results = [] } = await this.db
      .prepare(
        'SELECT at, actor_id, permission, action, target, outcome, detail FROM access_log ORDER BY seq',
      )
      .all<Record<string, string | null>>();
    return results.map((r) => ({
      at: r.at!,
      actorId: r.actor_id!,
      permission: r.permission as AccessEvent['permission'],
      action: r.action!,
      target: r.target ?? null,
      outcome: r.outcome as AccessEvent['outcome'],
      detail: r.detail ?? null,
    }));
  }
}

/** 固定窓の送信回数制限。窓の判定と加算を 1 文で行う。 */
export class D1RateLimiter implements RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;

  constructor(
    private readonly db: D1Database,
    { limit, windowMs }: { limit: number; windowMs: number },
  ) {
    if (limit < 1 || windowMs < 1) throw new Error('Rate limit must be positive');
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  async hit(key: string, now: Date): Promise<RateDecision> {
    const at = now.getTime();
    const row = await this.db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
         ON CONFLICT(key) DO UPDATE SET
           count = CASE WHEN ?2 - rate_limits.window_start >= ?3 THEN 1 ELSE rate_limits.count + 1 END,
           window_start = CASE WHEN ?2 - rate_limits.window_start >= ?3 THEN ?2 ELSE rate_limits.window_start END
         RETURNING count, window_start`,
      )
      .bind(key, at, this.#windowMs)
      .first<{ count: number; window_start: number }>();
    if (!row) throw new Error('Rate limit counter was not returned');
    if (Number(row.count) <= this.#limit) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((Number(row.window_start) + this.#windowMs - at) / 1000),
      ),
    };
  }

  /** 期限の過ぎた窓を消す。定期実行から呼ぶ */
  async purge(now: Date) {
    const result = await this.db
      .prepare('DELETE FROM rate_limits WHERE window_start <= ?1')
      .bind(now.getTime() - this.#windowMs)
      .run();
    return result.meta.changes;
  }
}
