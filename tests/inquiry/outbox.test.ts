import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETRY_DELAYS_MS,
  PermanentNotificationError,
  assertDualChannels,
  createOutbox,
  type NotificationChannel,
  type OutboxAlert,
} from '../../services/inquiry/outbox';
import { MemoryInquiryStore, type ChannelId } from '../../services/inquiry/records';
import { clock, makeRecord } from './fixtures';

const T0 = '2026-09-15T01:00:00.000Z';

function channel(id: ChannelId, behaviour: (attempt: number) => Error | null = () => null) {
  const keys: string[] = [];
  let attempt = 0;
  const adapter: NotificationChannel = {
    id,
    async send(_, { idempotencyKey }) {
      attempt += 1;
      const error = behaviour(attempt);
      if (error) throw error;
      keys.push(idempotencyKey);
    },
  };
  return { adapter, keys, attempts: () => attempt };
}

async function setup(email = channel('email'), line = channel('line')) {
  const time = clock(T0);
  const store = new MemoryInquiryStore();
  const alerts: OutboxAlert[] = [];
  await store.createOrGetRecent(makeRecord('INQ-1', T0), new Date(T0));
  const outbox = createOutbox({
    store,
    channels: [email.adapter, line.adapter],
    compose: (record, id) => ({ receiptId: record.id, channel: id, subject: record.id, body: record.id }),
    now: time.now,
    onAlert: (alert) => alerts.push(alert),
  });
  return { store, outbox, time, alerts, email, line };
}

describe('dual notification channels', () => {
  it('requires email plus exactly one of LINE or SMS', () => {
    expect(() => assertDualChannels(['email', 'sms'])).not.toThrow();
    expect(() => assertDualChannels(['email', 'line'])).not.toThrow();
    for (const bad of [['email'], ['line', 'sms'], ['email', 'email'], ['email', 'line', 'sms']] as ChannelId[][])
      expect(() => assertDualChannels(bad)).toThrow();
  });
});

describe('outbox delivery', () => {
  it('retries a failing channel with growing intervals while the other channel is delivered once', async () => {
    const { store, outbox, time, email, line } = await setup(
      channel('email'),
      channel('line', (n) => (n <= 2 ? new Error('timeout') : null)),
    );
    expect((await outbox.dispatch('INQ-1')).map((o) => o.result)).toEqual(['delivered', 'retry-scheduled']);
    expect((await store.get('INQ-1'))!.notifications[1]!.nextAttemptAt).toBe(
      new Date(Date.parse(T0) + DEFAULT_RETRY_DELAYS_MS[0]).toISOString(),
    );

    time.advance(30_000);
    expect(await outbox.dispatchDue()).toEqual([]);
    time.advance(30_000);
    expect((await outbox.dispatchDue()).map((o) => o.result)).toEqual(['skipped', 'retry-scheduled']);
    time.advance(DEFAULT_RETRY_DELAYS_MS[1]);
    expect((await outbox.dispatchDue()).map((o) => o.result)).toEqual(['skipped', 'delivered']);

    expect(email.keys).toEqual(['INQ-1:email']);
    expect(line.keys).toEqual(['INQ-1:line']);
    expect(line.attempts()).toBe(3);
    expect((await store.get('INQ-1'))!.notifications.map((n) => [n.status, n.attempts])).toEqual([
      ['delivered', 1],
      ['delivered', 3],
    ]);
  });

  it('never sends the same notification twice when dispatches overlap', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = channel('email');
    const blocking: NotificationChannel = {
      id: 'email',
      send: async (message, options) => {
        await gate;
        return slow.adapter.send(message, options);
      },
    };
    const { outbox } = await setup({ ...slow, adapter: blocking });
    const first = outbox.dispatch('INQ-1');
    const second = outbox.dispatch('INQ-1');
    release();
    const results = [...(await first), ...(await second)].filter((o) => o.channel === 'email').map((o) => o.result);
    expect(results.sort()).toEqual(['delivered', 'skipped']);
    expect(slow.keys).toEqual(['INQ-1:email']);
  });

  it('resends with the same idempotency key after an expired lease', async () => {
    const { store, outbox, time, email } = await setup();
    await store.update('INQ-1', (r) => ({
      ...r,
      notifications: r.notifications.map((n) =>
        n.channel === 'email'
          ? { ...n, status: 'sending', attempts: 1, leaseToken: 'crashed', leaseUntil: new Date(Date.parse(T0) + 120_000).toISOString() }
          : n,
      ),
    }));
    time.advance(60_000);
    expect((await outbox.dispatchDue()).find((o) => o.channel === 'email')!.result).toBe('skipped');
    time.advance(61_000);
    await outbox.dispatchDue();
    expect(email.keys).toEqual(['INQ-1:email']);
    expect((await store.get('INQ-1'))!.notifications[0]).toMatchObject({ status: 'delivered', attempts: 2 });
  });

  it('detects exhausted retries, permanent errors and total failure', async () => {
    const { store, outbox, time, alerts } = await setup(
      channel('email', () => new PermanentNotificationError('invalid recipient')),
      channel('line', () => new Error('still down')),
    );
    await outbox.dispatch('INQ-1');
    expect(alerts.map((a) => a.kind)).toEqual(['channel-failed']);
    for (const delay of DEFAULT_RETRY_DELAYS_MS) {
      time.advance(delay);
      await outbox.dispatchDue();
    }
    expect((await store.get('INQ-1'))!.notifications.map((n) => [n.status, n.attempts])).toEqual([
      ['failed', 1],
      ['failed', DEFAULT_RETRY_DELAYS_MS.length + 1],
    ]);
    expect(alerts.map((a) => a.kind)).toEqual(['channel-failed', 'channel-failed', 'all-channels-failed']);
    // The inquiry itself is never removed by notification failures.
    expect(await store.get('INQ-1')).toBeDefined();
    expect((await outbox.inspect()).map((a) => a.kind).sort()).toEqual([
      'all-channels-failed',
      'channel-failed',
      'channel-failed',
    ]);
  });

  it('reports notifications that are still undelivered after the alert delay', async () => {
    const { outbox, time } = await setup(channel('email'), channel('line', () => new Error('down')));
    await outbox.dispatch('INQ-1');
    expect(await outbox.inspect()).toEqual([]);
    time.advance(15 * 60_000);
    expect(await outbox.inspect()).toEqual([{ kind: 'delayed', receiptId: 'INQ-1', channel: 'line', minutes: 15 }]);
  });

  it('does not notify for quarantined submissions', async () => {
    const { store, outbox, email } = await setup();
    await store.createOrGetRecent(
      makeRecord('INQ-SPAM', T0, { fingerprint: 'spam', disposition: 'suspected-spam' }),
      new Date(T0),
    );
    expect((await outbox.dispatch('INQ-SPAM')).every((o) => o.result === 'skipped')).toBe(true);
    expect(email.keys).toEqual([]);
  });
});
