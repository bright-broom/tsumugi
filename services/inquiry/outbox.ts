/**
 * 二重通知の送信箱（ADR 0033）。
 *
 * - 通知の予定は受付記録と同じ書き込みで保存される（受付だけ残って通知が消える、が起きない）。
 * - チャネルごとに独立して送る。片系が落ちても、もう片系と受付記録には影響しない。
 * - 送信の前に「送信中」の貸出（lease）を記録して、同じ通知を二重に送らない。
 *   送信中に処理が止まった場合は貸出の期限後に再送する（少なくとも 1 回。重複防止の鍵をアダプタに渡す）。
 * - 一時的な失敗は間隔を空けて再試行し、上限に達したら failed にして警告を出す。
 */
import { randomToken } from './ids';
import type { ChannelId, InquiryRecord, InquiryStore, NotificationState } from './records';

export interface NotificationMessage {
  receiptId: string;
  channel: ChannelId;
  subject: string;
  body: string;
}

/** メール・LINE・SMS の送信アダプタ。実装は配備先で用意する（このリポジトリには実送信の実装を置かない） */
export interface NotificationChannel {
  readonly id: ChannelId;
  send(message: NotificationMessage, options: { idempotencyKey: string }): Promise<void>;
}

/** 宛先の誤りなど、再試行しても成功しない失敗 */
export class PermanentNotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentNotificationError';
  }
}

export function assertDualChannels(channels: readonly ChannelId[]): void {
  const set = new Set(channels);
  if (
    channels.length !== 2 ||
    set.size !== 2 ||
    !set.has('email') ||
    !(set.has('line') || set.has('sms'))
  )
    throw new Error('Inquiry notifications need exactly two channels: email and line or sms');
}

export function initialNotifications(
  receiptId: string,
  channels: readonly ChannelId[],
  now: Date,
): NotificationState[] {
  assertDualChannels(channels);
  return channels.map((channel) => ({
    channel,
    idempotencyKey: `${receiptId}:${channel}`,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now.toISOString(),
    leaseToken: null,
    leaseUntil: null,
    deliveredAt: null,
    lastError: null,
  }));
}

/** 1 分・5 分・15 分・1 時間・3 時間。初回を含め最大 6 回 */
export const DEFAULT_RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000, 10_800_000] as const;

export type OutboxAlert =
  | { kind: 'channel-failed'; receiptId: string; channel: ChannelId; lastError: string | null }
  | { kind: 'all-channels-failed'; receiptId: string }
  | { kind: 'delayed'; receiptId: string; channel: ChannelId; minutes: number };

export interface DispatchOutcome {
  receiptId: string;
  channel: ChannelId;
  result: 'delivered' | 'retry-scheduled' | 'failed' | 'skipped';
}

export interface OutboxOptions {
  store: InquiryStore;
  channels: readonly NotificationChannel[];
  compose: (record: InquiryRecord, channel: ChannelId) => NotificationMessage;
  retryDelaysMs?: readonly number[];
  leaseMs?: number;
  /** 受付からこの時間を過ぎても届いていない通知を delayed として報告する */
  delayAlertMs?: number;
  now?: () => Date;
  onAlert?: (alert: OutboxAlert) => void;
}

const summarize = (error: unknown) =>
  (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 200);

function patch(
  record: InquiryRecord,
  channel: ChannelId,
  change: Partial<NotificationState>,
): InquiryRecord {
  return {
    ...record,
    notifications: record.notifications.map((n) => (n.channel === channel ? { ...n, ...change } : n)),
  };
}

export function createOutbox(options: OutboxOptions) {
  const now = options.now ?? (() => new Date());
  const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const maxAttempts = delays.length + 1;
  const leaseMs = options.leaseMs ?? 120_000;
  const delayAlertMs = options.delayAlertMs ?? 900_000;
  const adapters = new Map(options.channels.map((c) => [c.id, c]));
  const alert = (a: OutboxAlert) => options.onAlert?.(a);

  const isDue = (n: NotificationState, at: string) =>
    (n.status === 'pending' && n.nextAttemptAt <= at) ||
    (n.status === 'sending' && n.leaseUntil !== null && n.leaseUntil <= at);

  async function deliver(recordId: string, channel: ChannelId): Promise<DispatchOutcome> {
    const token = randomToken();
    const claimedAt = now();
    const at = claimedAt.toISOString();
    const claimed = await options.store.update(recordId, (current) => {
      const n = current.notifications.find((x) => x.channel === channel);
      if (current.disposition !== 'accepted' || !n || !isDue(n, at)) return undefined;
      return patch(current, channel, {
        status: 'sending',
        attempts: n.attempts + 1,
        leaseToken: token,
        leaseUntil: new Date(claimedAt.getTime() + leaseMs).toISOString(),
      });
    });
    const state = claimed?.notifications.find((x) => x.channel === channel);
    if (!claimed || !state || state.leaseToken !== token)
      return { receiptId: recordId, channel, result: 'skipped' };

    let change: Partial<NotificationState>;
    let result: DispatchOutcome['result'];
    try {
      const adapter = adapters.get(channel);
      if (!adapter) throw new PermanentNotificationError(`No adapter for channel ${channel}`);
      await adapter.send(options.compose(claimed, channel), {
        idempotencyKey: state.idempotencyKey,
      });
      change = { status: 'delivered', deliveredAt: now().toISOString(), lastError: null };
      result = 'delivered';
    } catch (error) {
      const exhausted =
        error instanceof PermanentNotificationError || state.attempts >= maxAttempts;
      const retryAt = new Date(now().getTime() + (delays[state.attempts - 1] ?? 0));
      change = exhausted
        ? { status: 'failed', lastError: summarize(error) }
        : { status: 'pending', nextAttemptAt: retryAt.toISOString(), lastError: summarize(error) };
      result = exhausted ? 'failed' : 'retry-scheduled';
    }
    const finished = await options.store.update(recordId, (current) => {
      const n = current.notifications.find((x) => x.channel === channel);
      if (!n || n.leaseToken !== token) return undefined;
      return patch(current, channel, { ...change, leaseToken: null, leaseUntil: null });
    });
    if (result === 'failed') {
      alert({ kind: 'channel-failed', receiptId: recordId, channel, lastError: change.lastError ?? null });
      if (finished?.notifications.every((n) => n.status === 'failed'))
        alert({ kind: 'all-channels-failed', receiptId: recordId });
    }
    return { receiptId: recordId, channel, result };
  }

  async function dispatch(recordId: string): Promise<DispatchOutcome[]> {
    const record = await options.store.get(recordId);
    if (!record) return [];
    // チャネルは並行して送る。片方の例外がもう片方を止めない
    return Promise.all(record.notifications.map((n) => deliver(recordId, n.channel)));
  }

  return {
    dispatch,
    /** 定期実行（Cron など）から呼ぶ。期限の来た通知と、貸出が切れた通知を送る */
    async dispatchDue(): Promise<DispatchOutcome[]> {
      const at = now().toISOString();
      const outcomes: DispatchOutcome[] = [];
      for (const record of await options.store.list()) {
        if (record.disposition === 'accepted' && record.notifications.some((n) => isDue(n, at)))
          outcomes.push(...(await dispatch(record.id)));
      }
      return outcomes;
    },
    /** 失敗・遅延の検知。監視から定期的に呼び、結果を担当者へ知らせる */
    async inspect(): Promise<OutboxAlert[]> {
      const current = now();
      const alerts: OutboxAlert[] = [];
      for (const record of await options.store.list()) {
        if (record.disposition !== 'accepted') continue;
        const age = current.getTime() - Date.parse(record.receivedAt);
        for (const n of record.notifications) {
          if (n.status === 'failed')
            alerts.push({ kind: 'channel-failed', receiptId: record.id, channel: n.channel, lastError: n.lastError });
          else if (n.status !== 'delivered' && age >= delayAlertMs)
            alerts.push({ kind: 'delayed', receiptId: record.id, channel: n.channel, minutes: Math.floor(age / 60_000) });
        }
        if (record.notifications.length && record.notifications.every((n) => n.status === 'failed'))
          alerts.push({ kind: 'all-channels-failed', receiptId: record.id });
      }
      return alerts;
    },
  };
}
