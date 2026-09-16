import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileInquiryStore } from '../../services/inquiry/file-store';
import { makeRecord } from './fixtures';

const directories: string[] = [];
async function scratch() {
  const directory = await mkdtemp(join(tmpdir(), 'inquiry-store-'));
  directories.push(directory);
  return join(directory, 'nested');
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('file inquiry store (local development)', () => {
  it('persists records with owner-only permissions and survives a new instance', async () => {
    const directory = await scratch();
    const store = new FileInquiryStore(directory);
    const created = await store.createOrGetRecent(makeRecord('INQ-1', '2026-09-15T01:00:00.000Z'), new Date(0));
    expect(created).toMatchObject({ created: true, record: { version: 1 } });
    expect((await stat(store.file)).mode & 0o777).toBe(0o600);

    const reopened = new FileInquiryStore(directory);
    expect((await reopened.get('INQ-1'))!.fields.message).toBe('Sample inquiry body');
    const updated = await reopened.update('INQ-1', (r) => ({ ...r, contract: { ...r.contract, status: 'contracted' } }));
    expect(updated).toMatchObject({ version: 2, contract: { status: 'contracted' } });
    expect(await reopened.update('INQ-1', () => undefined)).toMatchObject({ version: 2 });
    expect(await reopened.update('missing', (r) => r)).toBeUndefined();
    expect(JSON.parse(await readFile(store.file, 'utf8'))).toMatchObject({ format: 1, records: [{ id: 'INQ-1' }] });

    expect(await reopened.delete('INQ-1')).toBe(true);
    expect(await reopened.delete('INQ-1')).toBe(false);
    expect(await new FileInquiryStore(directory).list()).toEqual([]);
  });

  it('serializes concurrent writes and folds duplicates within the window', async () => {
    const store = new FileInquiryStore(await scratch());
    const at = '2026-09-15T01:00:00.000Z';
    const results = await Promise.all([
      ...[1, 2, 3, 4].map((n) => store.createOrGetRecent(makeRecord(`INQ-${n}`, at, { fingerprint: `fp-${n}` }), new Date(0))),
      store.createOrGetRecent(makeRecord('INQ-dup', at, { fingerprint: 'fp-1' }), new Date(0)),
    ]);
    expect(results.map((r) => r.created)).toEqual([true, true, true, true, false]);
    expect(results[4]!.record.id).toBe('INQ-1');
    expect((await store.list()).map((r) => r.id)).toEqual(['INQ-1', 'INQ-2', 'INQ-3', 'INQ-4']);
    // Outside the window the same content becomes a new inquiry.
    const later = await store.createOrGetRecent(
      makeRecord('INQ-5', '2026-09-15T02:00:00.000Z', { fingerprint: 'fp-1' }),
      new Date('2026-09-15T01:50:00.000Z'),
    );
    expect(later.created).toBe(true);
  });
});
