/**
 * 保持期限と削除（ADR 0034）。privacy.ts の「保管の期間」「ご本人からのお求め」に対応する。
 *
 * - 非契約（prospect）: 最後のやり取りから prospectYears 年で削除
 * - 契約中（contracted）: 削除しない
 * - 契約終了（ended）: 終了日から afterContractEndYears 年で削除
 * - 迷惑投稿の疑い: 受付から suspectedSpamDays 日で削除
 * - 法的な保全（legalHold）がある記録は、期限を過ぎても削除せず例外として記録する
 *
 * 削除はドライランで対象を確認してから実行する。どちらも履歴に件数と受付番号だけを残す。
 * 通知で送ったメール・バックアップの複製はこの処理では消えない（docs/inquiry-data.md の手順で扱う）。
 */
import type { AccessLog } from './audit';
import type { InquiryRecord, InquiryStore } from './records';

export interface RetentionPolicy {
  prospectYears: number;
  afterContractEndYears: number;
  suspectedSpamDays: number;
}

const addYears = (iso: string, years: number) => {
  const date = new Date(iso);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
};
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * 86_400_000).toISOString();

/** 削除してよくなる時刻。契約中は null（期限なし） */
export function retentionDueAt(record: InquiryRecord, policy: RetentionPolicy): string | null {
  if (record.disposition === 'suspected-spam')
    return addDays(record.receivedAt, policy.suspectedSpamDays);
  switch (record.contract.status) {
    case 'contracted':
      return null;
    case 'ended':
      return addYears(
        record.contract.endedAt ?? record.contract.changedAt,
        policy.afterContractEndYears,
      );
    case 'prospect':
      return addYears(record.lastActivityAt, policy.prospectYears);
  }
}

export type RetentionDecision =
  | {
      id: string;
      action: 'delete';
      reason: 'suspected-spam-expired' | 'prospect-expired' | 'contract-retention-expired';
      dueAt: string;
    }
  | { id: string; action: 'keep'; reason: 'within-period' | 'active-contract'; dueAt: string | null }
  | { id: string; action: 'exception'; reason: 'legal-hold'; dueAt: string };

export function decideRetention(
  record: InquiryRecord,
  policy: RetentionPolicy,
  now: Date,
): RetentionDecision {
  const id = record.id;
  const dueAt = retentionDueAt(record, policy);
  if (dueAt === null) return { id, action: 'keep', reason: 'active-contract', dueAt };
  if (dueAt > now.toISOString()) return { id, action: 'keep', reason: 'within-period', dueAt };
  if (record.legalHold) return { id, action: 'exception', reason: 'legal-hold', dueAt };
  const reason =
    record.disposition === 'suspected-spam'
      ? 'suspected-spam-expired'
      : record.contract.status === 'ended'
        ? 'contract-retention-expired'
        : 'prospect-expired';
  return { id, action: 'delete', reason, dueAt };
}

/** ご本人からの削除のお求め。契約上・法令上の保管が必要な記録と、法的な保全中の記録は削除しない */
export function decideErasure(
  record: InquiryRecord,
  policy: RetentionPolicy,
  now: Date,
): { allowed: true } | { allowed: false; reason: 'legal-hold' | 'contract-retention' } {
  if (record.legalHold) return { allowed: false, reason: 'legal-hold' };
  if (record.disposition === 'accepted' && record.contract.status !== 'prospect') {
    const dueAt = retentionDueAt(record, policy);
    if (dueAt === null || dueAt > now.toISOString())
      return { allowed: false, reason: 'contract-retention' };
  }
  return { allowed: true };
}

export interface RetentionRun {
  dryRun: boolean;
  ranAt: string;
  actorId: string;
  /** 削除の対象（ドライランでは削除せずに一覧だけを返す） */
  due: Extract<RetentionDecision, { action: 'delete' }>[];
  deleted: string[];
  exceptions: Extract<RetentionDecision, { action: 'exception' }>[];
  kept: number;
  errors: { id: string; error: string }[];
}

export async function runRetention(options: {
  store: InquiryStore;
  log: AccessLog;
  actorId: string;
  policy: RetentionPolicy;
  now: Date;
  dryRun: boolean;
}): Promise<RetentionRun> {
  const { store, log, actorId, policy, now, dryRun } = options;
  const at = now.toISOString();
  const decisions = (await store.list()).map((r) => decideRetention(r, policy, now));
  const run: RetentionRun = {
    dryRun,
    ranAt: at,
    actorId,
    due: decisions.filter((d) => d.action === 'delete'),
    deleted: [],
    exceptions: decisions.filter((d) => d.action === 'exception'),
    kept: decisions.filter((d) => d.action === 'keep').length,
    errors: [],
  };
  const event = (action: string, target: string | null, outcome: 'allowed' | 'refused' | 'failed', detail: string) =>
    log.append({ at, actorId, permission: 'retention:manage', action, target, outcome, detail });

  for (const exception of run.exceptions)
    await event('retention-exception', exception.id, 'refused', exception.reason);

  if (!dryRun) {
    for (const item of run.due) {
      try {
        if (await store.delete(item.id)) {
          run.deleted.push(item.id);
          await event('retention-delete', item.id, 'allowed', item.reason);
        }
      } catch (error) {
        const message = error instanceof Error ? error.name : 'Error';
        run.errors.push({ id: item.id, error: message });
        await event('retention-delete', item.id, 'failed', message);
      }
    }
  }
  await event(
    dryRun ? 'retention-dry-run' : 'retention-run',
    null,
    run.errors.length ? 'failed' : 'allowed',
    `due=${run.due.length} deleted=${run.deleted.length} exceptions=${run.exceptions.length} errors=${run.errors.length}`,
  );
  return run;
}
