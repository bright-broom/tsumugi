/**
 * 担当者の権限と、閲覧・変更の履歴を必ず残す窓口（ADR 0034）。
 * 問い合わせ情報を読む・変える・消す操作は、この窓口を通す。保存先を直接渡さない。
 *
 * 担当者は最大 2 名（プライバシー表示「担当する2名以外がアクセスできない」）。
 * 名簿は src/content/inquiry.ts の INQUIRY_STAFF をデータで持ち、ここで数と役割を検証する。
 */
import type { AccessLog, Permission } from './audit';
import type { ContractStatus, InquiryRecord, InquiryStore, ReplyChannel } from './records';
import { withFirstReply } from './response';
import { decideErasure, runRetention, type RetentionPolicy } from './retention';

export type StaffRole = 'administrator' | 'responder';
export interface StaffMember {
  readonly id: string;
  readonly role: StaffRole;
  readonly active: boolean;
}

export const MAX_STAFF_WITH_ACCESS = 2;

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  administrator: ['inquiry:read', 'inquiry:update', 'retention:manage', 'audit:read'],
  responder: ['inquiry:read', 'inquiry:update'],
};

export function validateRoster(members: readonly StaffMember[]): readonly StaffMember[] {
  const ids = members.map((m) => m.id);
  if (new Set(ids).size !== ids.length) throw new Error('Staff ids must be unique');
  // 実名やメールアドレスを ID にしない
  if (ids.some((id) => !/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)))
    throw new Error('Staff ids must be short opaque identifiers');
  const active = members.filter((m) => m.active);
  if (active.length === 0 || active.length > MAX_STAFF_WITH_ACCESS)
    throw new Error(`Inquiry access must be limited to 1-${MAX_STAFF_WITH_ACCESS} active staff`);
  if (!active.some((m) => m.role === 'administrator'))
    throw new Error('At least one active administrator is required');
  return members;
}

export class AccessDeniedError extends Error {
  constructor(actorId: string, permission: Permission) {
    super(`${actorId} is not allowed to ${permission}`);
    this.name = 'AccessDeniedError';
  }
}

export function createInquiryDesk(options: {
  store: InquiryStore;
  roster: readonly StaffMember[];
  log: AccessLog;
  policy: RetentionPolicy;
  now?: () => Date;
}) {
  const { store, log, policy } = options;
  const roster = validateRoster(options.roster);
  const now = options.now ?? (() => new Date());

  const allows = (actorId: string, permission: Permission) =>
    roster.some((m) => m.id === actorId && m.active && ROLE_PERMISSIONS[m.role].includes(permission));

  /** 許可・拒否のどちらも、操作の前に履歴へ書く。履歴を書けなければ操作しない */
  async function authorize(actorId: string, permission: Permission, action: string, target: string | null) {
    const allowed = allows(actorId, permission);
    await log.append({
      at: now().toISOString(),
      actorId,
      permission,
      action,
      target,
      outcome: allowed ? 'allowed' : 'denied',
      detail: null,
    });
    if (!allowed) throw new AccessDeniedError(actorId, permission);
  }

  const touch = (record: InquiryRecord, at: string): InquiryRecord => ({
    ...record,
    lastActivityAt: at > record.lastActivityAt ? at : record.lastActivityAt,
  });

  return {
    async list(actorId: string) {
      await authorize(actorId, 'inquiry:read', 'list', null);
      return store.list();
    },
    async view(actorId: string, id: string) {
      await authorize(actorId, 'inquiry:read', 'view', id);
      return store.get(id);
    },
    async recordFirstReply(actorId: string, id: string, at: Date, channel: ReplyChannel) {
      await authorize(actorId, 'inquiry:update', 'record-first-reply', id);
      return store.update(id, (record) => withFirstReply(record, at, channel));
    },
    async setContractStatus(actorId: string, id: string, status: ContractStatus, at: Date) {
      await authorize(actorId, 'inquiry:update', 'set-contract-status', id);
      const iso = at.toISOString();
      return store.update(id, (record) =>
        touch(
          { ...record, contract: { status, changedAt: iso, endedAt: status === 'ended' ? iso : null } },
          iso,
        ),
      );
    },
    /** 紛争・法令上の求めなどで削除を止める。reason は区分だけを書き、個人情報を書かない */
    async placeLegalHold(actorId: string, id: string, reason: string) {
      await authorize(actorId, 'retention:manage', 'place-legal-hold', id);
      const placedAt = now().toISOString();
      return store.update(id, (record) => ({
        ...record,
        legalHold: { reason, placedAt, placedBy: actorId },
      }));
    },
    async releaseLegalHold(actorId: string, id: string) {
      await authorize(actorId, 'retention:manage', 'release-legal-hold', id);
      return store.update(id, (record) => (record.legalHold ? { ...record, legalHold: null } : undefined));
    },
    /** ご本人からの削除のお求め。保管が必要な記録は削除せず、理由を履歴に残して返す */
    async erase(actorId: string, id: string) {
      await authorize(actorId, 'retention:manage', 'erase', id);
      const record = await store.get(id);
      if (!record) return { erased: false as const, reason: 'not-found' as const };
      const at = now();
      const decision = decideErasure(record, policy, at);
      if (!decision.allowed) {
        await log.append({
          at: at.toISOString(),
          actorId,
          permission: 'retention:manage',
          action: 'erase',
          target: id,
          outcome: 'refused',
          detail: decision.reason,
        });
        return { erased: false as const, reason: decision.reason };
      }
      await store.delete(id);
      return { erased: true as const };
    },
    async runRetention(actorId: string, { dryRun }: { dryRun: boolean }) {
      await authorize(actorId, 'retention:manage', dryRun ? 'retention-dry-run' : 'retention-run', null);
      return runRetention({ store, log, actorId, policy, now: now(), dryRun });
    },
    async auditTrail(actorId: string) {
      await authorize(actorId, 'audit:read', 'audit-trail', null);
      return log.list();
    },
  };
}
