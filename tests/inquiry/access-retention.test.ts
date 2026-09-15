import { describe, expect, it } from 'vitest';
import { INQUIRY_RETENTION, INQUIRY_STAFF } from '@/content/inquiry';
import { getMessages } from '@/i18n/catalog';
import {
  AccessDeniedError,
  MAX_STAFF_WITH_ACCESS,
  createInquiryDesk,
  validateRoster,
} from '../../services/inquiry/access';
import { MemoryAccessLog } from '../../services/inquiry/audit';
import { MemoryInquiryStore, type InquiryRecord, type InquiryStore } from '../../services/inquiry/records';
import { decideRetention, runRetention } from '../../services/inquiry/retention';
import { SAMPLE_FIELDS, clock, makeRecord } from './fixtures';

const privacy = getMessages().privacy;

describe('privacy promises are backed by data', () => {
  it('limits access to the number of staff stated on the privacy page', () => {
    expect(privacy.rows24).toContain(`${MAX_STAFF_WITH_ACCESS} 名`);
    expect(INQUIRY_STAFF.filter((m) => m.active).length).toBeLessThanOrEqual(MAX_STAFF_WITH_ACCESS);
    expect(() => validateRoster(INQUIRY_STAFF)).not.toThrow();
  });
  it('uses the retention periods stated on the privacy page', () => {
    expect(privacy.rows20).toContain(`${INQUIRY_RETENTION.prospectYears} 年で削除`);
    expect(privacy.rows20).toContain(`${INQUIRY_RETENTION.afterContractEndYears} 年`);
  });
});

describe('staff roster', () => {
  it.each([
    ['more than two active members', [
      { id: 'a', role: 'administrator', active: true },
      { id: 'b', role: 'responder', active: true },
      { id: 'c', role: 'responder', active: true },
    ]],
    ['duplicate ids', [
      { id: 'a', role: 'administrator', active: true },
      { id: 'a', role: 'responder', active: true },
    ]],
    ['identifiers that look like personal data', [{ id: 'someone@example.com', role: 'administrator', active: true }]],
    ['no administrator', [{ id: 'a', role: 'responder', active: true }]],
  ] as const)('rejects %s', (_, roster) => {
    expect(() => validateRoster(roster)).toThrow();
  });
  it('allows an inactive former member to stay on record without access', () => {
    expect(() =>
      validateRoster([
        { id: 'a', role: 'administrator', active: true },
        { id: 'b', role: 'responder', active: true },
        { id: 'c', role: 'responder', active: false },
      ]),
    ).not.toThrow();
  });
});

async function desk(records: InquiryRecord[], now = '2026-09-15T01:00:00.000Z', store: InquiryStore = new MemoryInquiryStore()) {
  for (const record of records) await store.createOrGetRecent(record, new Date(8.64e15));
  const log = new MemoryAccessLog();
  const time = clock(now);
  const roster = [
    { id: 'admin-1', role: 'administrator', active: true },
    { id: 'responder-1', role: 'responder', active: true },
    { id: 'former-1', role: 'administrator', active: false },
  ] as const;
  return { desk: createInquiryDesk({ store, roster, log, policy: INQUIRY_RETENTION, now: time.now }), log, store, time };
}

describe('access control and audit trail', () => {
  it('logs allowed and denied access by staff id and receipt number only', async () => {
    const { desk: d, log } = await desk([makeRecord('INQ-1', '2026-09-14T01:00:00.000Z')]);
    expect((await d.view('responder-1', 'INQ-1'))!.fields.name).toBe(SAMPLE_FIELDS.name);
    await d.recordFirstReply('responder-1', 'INQ-1', new Date('2026-09-14T03:00:00.000Z'), 'tel');
    await expect(d.view('outsider', 'INQ-1')).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(d.view('former-1', 'INQ-1')).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(d.erase('responder-1', 'INQ-1')).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(d.runRetention('responder-1', { dryRun: true })).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(d.auditTrail('responder-1')).rejects.toBeInstanceOf(AccessDeniedError);

    const trail = await d.auditTrail('admin-1');
    expect(trail.map((e) => [e.actorId, e.action, e.target, e.outcome])).toEqual([
      ['responder-1', 'view', 'INQ-1', 'allowed'],
      ['responder-1', 'record-first-reply', 'INQ-1', 'allowed'],
      ['outsider', 'view', 'INQ-1', 'denied'],
      ['former-1', 'view', 'INQ-1', 'denied'],
      ['responder-1', 'erase', 'INQ-1', 'denied'],
      ['responder-1', 'retention-dry-run', null, 'denied'],
      ['responder-1', 'audit-trail', null, 'denied'],
      ['admin-1', 'audit-trail', null, 'allowed'],
    ]);
    const serialized = JSON.stringify(await log.list());
    for (const value of Object.values(SAMPLE_FIELDS)) if (value) expect(serialized).not.toContain(value);
  });

  it('does not perform an operation when the audit trail cannot be written', async () => {
    const store = new MemoryInquiryStore();
    await store.createOrGetRecent(makeRecord('INQ-1', '2026-09-14T01:00:00.000Z'), new Date(0));
    const d = createInquiryDesk({
      store,
      roster: INQUIRY_STAFF,
      log: { append: async () => { throw new Error('log offline'); }, list: async () => [] },
      policy: INQUIRY_RETENTION,
    });
    await expect(d.setContractStatus('member-1', 'INQ-1', 'contracted', new Date())).rejects.toThrow('log offline');
    expect((await store.get('INQ-1'))!.contract.status).toBe('prospect');
  });
});

describe('retention', () => {
  const now = new Date('2026-09-15T01:00:00.000Z');
  const decide = (record: InquiryRecord) => decideRetention(record, INQUIRY_RETENTION, now);

  it('deletes non-contract inquiries one year after the last activity', () => {
    const old = makeRecord('p1', '2025-09-15T00:59:00.000Z');
    expect(decide(old)).toMatchObject({ action: 'delete', reason: 'prospect-expired', dueAt: '2026-09-15T00:59:00.000Z' });
    expect(decide({ ...old, lastActivityAt: '2025-10-01T00:00:00.000Z' })).toMatchObject({ action: 'keep', reason: 'within-period' });
  });
  it('keeps active contracts and deletes seven years after a contract ends', () => {
    const received = '2018-01-10T00:00:00.000Z';
    expect(decide(makeRecord('c1', received, { contract: { status: 'contracted', changedAt: received, endedAt: null } }))).toMatchObject({
      action: 'keep',
      reason: 'active-contract',
    });
    const ended = (endedAt: string) => makeRecord('c2', received, { contract: { status: 'ended', changedAt: endedAt, endedAt } });
    expect(decide(ended('2019-09-15T00:00:00.000Z'))).toMatchObject({ action: 'delete', reason: 'contract-retention-expired' });
    expect(decide(ended('2020-01-01T00:00:00.000Z'))).toMatchObject({ action: 'keep', dueAt: '2027-01-01T00:00:00.000Z' });
  });
  it('removes suspected spam after 30 days and records legal holds as exceptions', () => {
    expect(decide(makeRecord('s1', '2026-08-15T00:00:00.000Z', { disposition: 'suspected-spam' }))).toMatchObject({
      action: 'delete',
      reason: 'suspected-spam-expired',
    });
    expect(
      decide(makeRecord('h1', '2024-01-01T00:00:00.000Z', { legalHold: { reason: 'dispute', placedAt: now.toISOString(), placedBy: 'admin-1' } })),
    ).toMatchObject({ action: 'exception', reason: 'legal-hold' });
  });

  it('shows the plan in a dry run, then deletes, logging exceptions and failures without stopping', async () => {
    const records = [
      makeRecord('expired-1', '2024-01-01T00:00:00.000Z', { fingerprint: 'a' }),
      makeRecord('expired-2', '2024-02-01T00:00:00.000Z', { fingerprint: 'b' }),
      makeRecord('broken', '2024-03-01T00:00:00.000Z', { fingerprint: 'c' }),
      makeRecord('held', '2024-01-01T00:00:00.000Z', {
        fingerprint: 'd',
        legalHold: { reason: 'dispute', placedAt: '2025-01-01T00:00:00.000Z', placedBy: 'admin-1' },
      }),
      makeRecord('recent', '2026-09-01T00:00:00.000Z', { fingerprint: 'e' }),
    ];
    const memory = new MemoryInquiryStore();
    const store: InquiryStore = {
      createOrGetRecent: (r, t) => memory.createOrGetRecent(r, t),
      get: (id) => memory.get(id),
      update: (id, change) => memory.update(id, change),
      list: () => memory.list(),
      delete: async (id) => {
        if (id === 'broken') throw new Error('disk error');
        return memory.delete(id);
      },
    };
    const { desk: d, log } = await desk(records, now.toISOString(), store);

    const dry = await d.runRetention('admin-1', { dryRun: true });
    expect(dry).toMatchObject({ dryRun: true, deleted: [], kept: 1, errors: [] });
    expect(dry.due.map((x) => x.id)).toEqual(['expired-1', 'expired-2', 'broken']);
    expect(dry.exceptions.map((x) => x.id)).toEqual(['held']);
    expect(await store.list()).toHaveLength(5);

    const run = await d.runRetention('admin-1', { dryRun: false });
    expect(run.deleted).toEqual(['expired-1', 'expired-2']);
    expect(run.errors).toEqual([{ id: 'broken', error: 'Error' }]);
    expect((await store.list()).map((r) => r.id).sort()).toEqual(['broken', 'held', 'recent']);

    const events = (await log.list()).map((e) => [e.action, e.target, e.outcome, e.detail]);
    expect(events).toContainEqual(['retention-dry-run', null, 'allowed', 'due=3 deleted=0 exceptions=1 errors=0']);
    expect(events).toContainEqual(['retention-exception', 'held', 'refused', 'legal-hold']);
    expect(events).toContainEqual(['retention-delete', 'expired-1', 'allowed', 'prospect-expired']);
    expect(events).toContainEqual(['retention-delete', 'broken', 'failed', 'Error']);
    expect(events).toContainEqual(['retention-run', null, 'failed', 'due=3 deleted=2 exceptions=1 errors=1']);
  });

  it('can run from a scheduler identity without granting it staff access', async () => {
    const store = new MemoryInquiryStore();
    await store.createOrGetRecent(makeRecord('expired', '2024-01-01T00:00:00.000Z'), new Date(0));
    const log = new MemoryAccessLog();
    const run = await runRetention({ store, log, actorId: 'system-retention', policy: INQUIRY_RETENTION, now, dryRun: false });
    expect(run.deleted).toEqual(['expired']);
    expect((await log.list()).every((e) => e.actorId === 'system-retention')).toBe(true);
  });

  it('erases on request unless a contract or legal hold requires keeping the record', async () => {
    const received = '2026-09-01T00:00:00.000Z';
    const { desk: d, store, log } = await desk([
      makeRecord('prospect', received, { fingerprint: 'a' }),
      makeRecord('client', received, { fingerprint: 'b', contract: { status: 'contracted', changedAt: received, endedAt: null } }),
      makeRecord('held', received, { fingerprint: 'c', legalHold: { reason: 'dispute', placedAt: received, placedBy: 'admin-1' } }),
    ]);
    expect(await d.erase('admin-1', 'prospect')).toEqual({ erased: true });
    expect(await d.erase('admin-1', 'client')).toEqual({ erased: false, reason: 'contract-retention' });
    expect(await d.erase('admin-1', 'held')).toEqual({ erased: false, reason: 'legal-hold' });
    expect(await d.erase('admin-1', 'missing')).toEqual({ erased: false, reason: 'not-found' });
    expect((await store.list()).map((r) => r.id).sort()).toEqual(['client', 'held']);
    expect((await log.list()).filter((e) => e.outcome === 'refused').map((e) => [e.target, e.detail])).toEqual([
      ['client', 'contract-retention'],
      ['held', 'legal-hold'],
    ]);

    await d.releaseLegalHold('admin-1', 'held');
    expect(await d.erase('admin-1', 'held')).toEqual({ erased: true });
  });

  it('updates the retention clock when the contract status changes', async () => {
    const { desk: d } = await desk([makeRecord('INQ-1', '2025-01-01T00:00:00.000Z')]);
    await d.placeLegalHold('admin-1', 'INQ-1', 'dispute');
    const ended = await d.setContractStatus('responder-1', 'INQ-1', 'ended', new Date('2026-03-31T00:00:00.000Z'));
    expect(ended).toMatchObject({
      contract: { status: 'ended', endedAt: '2026-03-31T00:00:00.000Z' },
      lastActivityAt: '2026-03-31T00:00:00.000Z',
      legalHold: { reason: 'dispute', placedBy: 'admin-1' },
    });
  });
});
