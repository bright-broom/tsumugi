import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '@/content/prices';
import { writeJson } from '../../tools/ops/shared/store';
import {
  type RequestsFile,
  addRequest,
  allowanceFor,
  assignRequest,
  loadRequests,
  logWork,
  monthlyWork,
  moveRequest,
  openRequests,
  recordCompletionNotice,
  requestsFileSchema,
  threeMonthAverage,
} from '../../tools/ops/requests/model';

const empty: RequestsFile = {
  customerId: 'sample-shop',
  trackingSince: '2026-06-01',
  requests: [],
};
const base = {
  receivedAt: '2026-08-03T10:00:00+09:00',
  channel: 'サンプル受付',
  url: 'https://example.jp/menu.html',
  location: { selector: 'main h2:nth-of-type(2)', x: 120, y: 480, viewportWidth: 390 },
  description: '料金表の見出しを差し替える（サンプル）',
  by: 'サンプル担当',
};
const meta = (by = 'サンプル担当') => ({ at: '2026-08-04T09:00:00+09:00', by });

const started = () => {
  const { file, id } = addRequest(empty, base);
  return { file: moveRequest(file, id, 'in_progress', meta()), id };
};

describe('受付と状態', () => {
  it('URL・画面位置・説明・添付の参照を持って受け付ける', () => {
    const { file, id } = addRequest(empty, {
      ...base,
      attachments: [{ ref: 'shared-drive:/sample/photo-01.jpg' }],
      dueOn: '2026-08-10',
      assignee: 'サンプル担当',
    });
    expect(id).toBe('req-0001');
    expect(file.requests[0]).toMatchObject({
      status: 'received',
      location: base.location,
      attachments: [{ ref: 'shared-drive:/sample/photo-01.jpg' }],
      dueOn: '2026-08-10',
    });
    expect(file.requests[0]!.history).toEqual([
      { at: base.receivedAt, by: base.by, from: null, to: 'received' },
    ]);
  });

  it('位置の指定がない依頼・http(s) 以外の URL・記録開始前の受付を拒否する', () => {
    expect(() => addRequest(empty, { ...base, location: {} })).toThrow('画面上の位置');
    expect(() => addRequest(empty, { ...base, url: 'javascript:alert(1)' })).toThrow('URL');
    expect(() => addRequest(empty, { ...base, receivedAt: '2026-05-31T12:00:00+09:00' })).toThrow(
      '記録開始日',
    );
  });

  it('受付 → 着手 → 確認待ち → 差し戻し → 確認待ち → 完了。飛ばす・戻す遷移は拒否する', () => {
    const { file, id } = addRequest(empty, base);
    expect(() => moveRequest(file, id, 'done', meta())).toThrow('進められません');
    expect(() => moveRequest(file, id, 'paused', meta())).toThrow('状態は');
    let f = moveRequest(file, id, 'in_progress', meta());
    f = moveRequest(f, id, 'awaiting_review', meta());
    f = moveRequest(f, id, 'in_progress', { ...meta(), note: '差し戻し' });
    f = moveRequest(f, id, 'awaiting_review', meta());
    f = moveRequest(f, id, 'done', meta('サンプル顧客'));
    expect(f.requests[0]!.history.map((h) => h.to)).toEqual([
      'received',
      'in_progress',
      'awaiting_review',
      'in_progress',
      'awaiting_review',
      'done',
    ]);
    expect(() => moveRequest(f, id, 'in_progress', meta())).toThrow('進められません');
    expect(() => assignRequest(f, id, { assignee: '別の担当' })).toThrow('完了した');
  });

  it('期限超過の未完了依頼を出す', () => {
    const { file, id } = addRequest(empty, { ...base, dueOn: '2026-08-05' });
    expect(openRequests(file, '2026-08-06')).toEqual([
      { request: file.requests[0], overdue: true },
    ]);
    expect(
      openRequests(assignRequest(file, id, { dueOn: '2026-08-31' }), '2026-08-06')[0]!.overdue,
    ).toBe(false);
  });

  it('完了連絡は完了後に 1 回だけ記録する（送信はしない）', () => {
    const { file, id } = started();
    expect(() =>
      recordCompletionNotice(file, id, { recordedAt: base.receivedAt, by: 'x', channel: 'メール' }),
    ).toThrow('完了してから');
    let f = moveRequest(moveRequest(file, id, 'awaiting_review', meta()), id, 'done', meta());
    f = recordCompletionNotice(f, id, {
      recordedAt: '2026-08-05T10:00:00+09:00',
      by: 'サンプル担当',
      channel: '電話',
    });
    expect(f.requests[0]!.completionNotice?.channel).toBe('電話');
    expect(() =>
      recordCompletionNotice(f, id, { recordedAt: base.receivedAt, by: 'x', channel: 'x' }),
    ).toThrow('記録済み');
  });
});

describe('作業時間', () => {
  it('着手前・受付前の日付の記録を拒否する', () => {
    const { file, id } = addRequest(empty, base);
    expect(() =>
      logWork(file, id, { kind: 'change', date: '2026-08-03', minutes: 5, by: 'x' }),
    ).toThrow('着手してから');
    const s = started();
    expect(() =>
      logWork(s.file, s.id, { kind: 'change', date: '2026-08-02', minutes: 5, by: 'x' }),
    ).toThrow('受付より前');
  });

  it('月の合計を 5 分単位で切り上げ、依頼ごとには切り上げない。他の月の記録を混ぜない', () => {
    const a = started();
    let f = logWork(a.file, a.id, { kind: 'change', date: '2026-08-04', minutes: 7, by: 'x' });
    const second = addRequest(f, { ...base, receivedAt: '2026-08-10T10:00:00+09:00' });
    f = moveRequest(second.file, second.id, 'in_progress', meta());
    f = logWork(f, second.id, { kind: 'change', date: '2026-08-11', minutes: 11, by: 'x' });
    f = logWork(f, second.id, { kind: 'change', date: '2026-09-01', minutes: 30, by: 'x' });
    const aug = monthlyWork(f, '2026-08');
    expect(aug.rawMinutes).toBe(18);
    expect(aug.billedMinutes).toBe(20);
    expect(aug.byRequest.map((r) => r.minutes)).toEqual([7, 11]);
    expect(monthlyWork(f, '2026-09').rawMinutes).toBe(30);
  });

  it('3 か月平均は、3 か月とも月初から記録しているときだけ出す', () => {
    const s = started();
    const f = logWork(s.file, s.id, { kind: 'change', date: '2026-08-04', minutes: 30, by: 'x' });
    expect(threeMonthAverage(f, '2026-08').averageMinutes).toBe(10);
    const late = { ...f, trackingSince: '2026-07-15' };
    const result = threeMonthAverage(late, '2026-08');
    expect(result.averageMinutes).toBeNull();
    expect(result.months.map((m) => [m.month, m.tracked, m.partial])).toEqual([
      ['2026-06', false, false],
      ['2026-07', true, true],
      ['2026-08', true, false],
    ]);
  });

  it('変更枠は公開料金の作業分数を使う', () => {
    expect(allowanceFor('run_basic')).toEqual({
      name: run('run_basic').name,
      minutes: run('run_basic').minutes,
    });
    expect(() => allowanceFor('run_unknown')).toThrow('プラン');
  });
});

describe('顧客の分離', () => {
  it('他の顧客の依頼が混ざったファイルを拒否する', () => {
    const { file } = addRequest(empty, base);
    const mixed = { ...file, requests: [{ ...file.requests[0]!, customerId: 'other-shop' }] };
    expect(requestsFileSchema.safeParse(mixed).success).toBe(false);
    const dir = mkdtempSync(join(tmpdir(), 'ops-requests-'));
    try {
      writeJson(join(dir, 'requests', 'sample-shop.json'), { ...empty, customerId: 'other-shop' });
      expect(() => loadRequests(dir, 'sample-shop')).toThrow('顧客 ID が一致しません');
      expect(loadRequests(dir, 'nobody')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('無償修補と未分類の記録', () => {
  it('通常変更の月合計だけ丸め、同じ依頼の修補と翌月の作業を除外する', () => {
    const s = started();
    let f = logWork(s.file, s.id, { kind: 'change', date: '2026-08-04', minutes: 7, by: 'x' });
    f = logWork(f, s.id, {
      kind: 'warranty',
      date: '2026-08-04',
      minutes: 40,
      by: 'x',
      note: '合意仕様と異なる表示を修補',
    });
    const second = addRequest(f, base);
    f = moveRequest(second.file, second.id, 'in_progress', meta());
    f = logWork(f, second.id, { kind: 'change', date: '2026-08-05', minutes: 6, by: 'x' });
    f = logWork(f, second.id, {
      kind: 'warranty',
      date: '2026-09-01',
      minutes: 100,
      by: 'x',
      note: '仕様不適合',
    });
    expect(monthlyWork(f, '2026-08')).toMatchObject({
      rawMinutes: 53,
      changeMinutes: 13,
      warrantyMinutes: 40,
      unclassifiedMinutes: 0,
      billedMinutes: 15,
    });
    expect(
      monthlyWork(f, '2026-08').byRequest.map((r) => [
        r.minutes,
        r.changeMinutes,
        r.warrantyMinutes,
      ]),
    ).toEqual([
      [47, 7, 40],
      [6, 6, 0],
    ]);
    expect(monthlyWork(f, '2026-09')).toMatchObject({ rawMinutes: 100, billedMinutes: 0 });
    expect(threeMonthAverage(f, '2026-08').averageMinutes).toBe(5);
  });

  it.each([undefined, 'repair', ''])('新規記録の区分 %s を拒否する', (kind) => {
    const s = started();
    expect(() =>
      logWork(s.file, s.id, { kind: kind as string, date: '2026-08-04', minutes: 5, by: 'x' }),
    ).toThrow('作業区分');
    expect(s.file.requests[0]!.work).toEqual([]);
  });

  it.each([undefined, '', '   '])('修補の根拠が空なら保存も直接読込も拒否する', (note) => {
    const s = started();
    const work = {
      kind: 'warranty',
      date: '2026-08-04',
      minutes: 5,
      by: 'x',
      ...(note === undefined ? {} : { note }),
    };
    expect(() => logWork(s.file, s.id, work)).toThrow();
    expect(
      requestsFileSchema.safeParse({
        ...s.file,
        requests: [{ ...s.file.requests[0]!, work: [work] }],
      }).success,
    ).toBe(false);
  });

  it('旧記録を変更せず読み、消費枠と3か月平均を未確定にする', () => {
    const s = started();
    const legacy = {
      ...s.file,
      requests: [
        { ...s.file.requests[0]!, work: [{ date: '2026-08-04', minutes: 31, by: '旧担当' }] },
      ],
    };
    const parsed = requestsFileSchema.parse(legacy);
    expect(parsed).toEqual(legacy);
    const f = logWork(parsed, s.id, {
      kind: 'warranty',
      date: '2026-08-05',
      minutes: 10,
      by: 'x',
      note: '仕様不適合',
    });
    expect(monthlyWork(f, '2026-08')).toMatchObject({
      rawMinutes: 41,
      warrantyMinutes: 10,
      unclassifiedMinutes: 31,
      billedMinutes: null,
    });
    expect(threeMonthAverage(f, '2026-08').averageMinutes).toBeNull();
    expect(monthlyWork(f, '2026-09').billedMinutes).toBe(0);
  });

  it('CLI で区分必須、失敗時は無変更、修補保存と枠集計を一貫して扱う', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-work-cli-'));
    const path = join(dir, 'requests', 'sample-shop.json');
    const s = started();
    const cli = (...args: string[]) =>
      spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'tools/ops/requests/cli.ts',
          ...args,
          '--data',
          dir,
          '--customer',
          'sample-shop',
        ],
        { encoding: 'utf8' },
      );
    try {
      writeJson(path, s.file);
      const before = readFileSync(path, 'utf8');
      const args = ['log', '--id', s.id, '--minutes', '40', '--date', '2026-08-04', '--by', '担当'];
      expect(cli(...args).status).toBe(1);
      expect(cli(...args, '--kind', 'warranty').status).toBe(1);
      expect(readFileSync(path, 'utf8')).toBe(before);
      expect(cli(...args, '--kind', 'warranty', '--note', '仕様不適合の修補').status).toBe(0);
      const hours = cli('hours', '--month', '2026-08', '--plan', 'run_basic');
      expect(hours.status).toBe(0);
      expect(hours.stdout).toContain('実作業 40分');
      expect(hours.stdout).toContain('変更枠消費 0分');
      expect(hours.stdout).toContain('残り 30分');
      const legacy = {
        ...s.file,
        requests: [
          { ...s.file.requests[0]!, work: [{ date: '2026-08-04', minutes: 40, by: 'x' }] },
        ],
      };
      writeJson(path, legacy);
      const uncertain = cli('hours', '--month', '2026-08', '--plan', 'run_basic');
      expect(uncertain.stdout).toContain('未確定');
      expect(uncertain.stdout).not.toMatch(/残り|超過/);
      expect(cli('hours', '--month', '2026-05', '--plan', 'run_basic').stdout).not.toMatch(
        /残り|超過/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
