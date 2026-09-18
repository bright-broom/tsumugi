/** テスト用：Node 内蔵の SQLite で D1 の API の一部を再現し、本物の SQL の制約・原子性で検査する。 */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement } from '../../services/inquiry/d1';

const SCHEMA = readFileSync(
  new URL('../../services/inquiry/migrations/0001_init.sql', import.meta.url),
  'utf8',
);

/**
 * D1 は ?1 形式の番号付きパラメータを使う。古い Node の SQLite は番号付きの束縛を扱えないため、
 * 出現順の ? に展開して値を並べ直す（SQL の文字列に ? を含めない前提のテスト用）。
 */
function positional(query: string, values: readonly unknown[]) {
  const order: number[] = [];
  const sql = query.replace(/\?(\d+)/g, (_, n: string) => {
    order.push(Number(n));
    return '?';
  });
  return { sql, args: (order.length ? order.map((i) => values[i - 1]) : values) as never[] };
}

export function sqliteD1(): D1Database & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec(SCHEMA);
  const statement = (query: string, values: unknown[] = []): D1PreparedStatement => {
    const run = () => positional(query, values);
    return {
      bind: (...next: unknown[]) => statement(query, next),
      first: async <T>() => {
        const { sql, args } = run();
        return (raw.prepare(sql).get(...args) ?? null) as T | null;
      },
      all: async <T>() => {
        const { sql, args } = run();
        return { results: raw.prepare(sql).all(...args) as T[], meta: { changes: 0 } };
      },
      run: async () => {
        const { sql, args } = run();
        return { meta: { changes: Number(raw.prepare(sql).run(...args).changes) } };
      },
    };
  };
  return { raw, prepare: (query: string) => statement(query) };
}
