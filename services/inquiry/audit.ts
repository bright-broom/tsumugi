/**
 * 閲覧・変更・削除の履歴（ADR 0034）。記録するのは担当者 ID・操作・対象の受付番号・結果だけで、
 * 問い合わせの内容や連絡先は書かない。本番では追記専用の保存先で同じインターフェースを実装する。
 */

export type Permission = 'inquiry:read' | 'inquiry:update' | 'retention:manage' | 'audit:read';

export interface AccessEvent {
  at: string;
  actorId: string;
  permission: Permission;
  action: string;
  target: string | null;
  outcome: 'allowed' | 'denied' | 'refused' | 'failed';
  /** 理由の区分や件数。個人情報を書かない */
  detail: string | null;
}

export interface AccessLog {
  append(event: AccessEvent): Promise<void>;
  list(): Promise<AccessEvent[]>;
}

export class MemoryAccessLog implements AccessLog {
  readonly #events: AccessEvent[] = [];
  async append(event: AccessEvent) {
    this.#events.push(Object.freeze({ ...event }));
  }
  async list() {
    return [...this.#events];
  }
}
