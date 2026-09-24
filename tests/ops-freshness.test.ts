import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boundaries, describeBoundary, refreshDecision } from '../tools/ops/freshness';
import { defineStore, type HoursException, type StoreProfile } from '../src/lib/storefront/store';
import type { IsoDate } from '../src/lib/storefront/core';

const ROOT = join(import.meta.dirname, '..');
const HOURS = [{ opens: '09:00', closes: '18:00' }];

const store = (exceptions: readonly HoursException[]): StoreProfile =>
  defineStore({
    name: '架空の美容室',
    description: '日付で変わる案内の検査（サンプル）',
    url: 'https://example.test/',
    businessType: 'BeautySalon',
    language: 'ja',
    timeZone: 'Asia/Tokyo',
    locations: [
      {
        id: 'main',
        telephone: '03-0000-0000',
        address: { postalCode: '1000001', region: '東京都', locality: '千代田区', street: '1-1' },
        hours: { Monday: HOURS, Tuesday: HOURS, Wednesday: HOURS, Thursday: HOURS, Friday: HOURS },
        exceptions,
      },
    ],
  });

const closed = (from: IsoDate, to?: IsoDate, note?: string): HoursException => ({
  closed: true,
  from,
  ...(to ? { to } : {}),
  ...(note ? { note } : {}),
});

describe('日付で表示が変わる境目', () => {
  it('臨時の案内が無ければ、作り直さない', () => {
    expect(boundaries(store([]), '2026-12-28', '2026-12-29')).toEqual([]);
  });

  it('始まる日と、終わった翌日を境目にする', () => {
    const s = store([closed('2026-12-29', '2027-01-03', '年末年始')]);
    // 前日までは「予定」、当日から「臨時休業中」
    expect(boundaries(s, '2026-12-28', '2026-12-29').map(describeBoundary)).toEqual([
      'main: 臨時休業 2026-12-29〜2027-01-03（年末年始） が始まります',
    ]);
    // 期間の途中では変わらない
    expect(boundaries(s, '2026-12-30', '2026-12-31')).toEqual([]);
    // 終わった翌日に表示から外れる
    expect(boundaries(s, '2027-01-03', '2027-01-04').map(describeBoundary)).toEqual([
      'main: 臨時休業 2026-12-29〜2027-01-03（年末年始） が終わり、表示から外れます',
    ]);
    // それ以降は何も起きない
    expect(boundaries(s, '2027-01-04', '2027-01-05')).toEqual([]);
  });

  it('1 日だけの案内、臨時の営業時間、複数の案内をまとめて見る', () => {
    const s = store([
      closed('2026-11-03', undefined, '設備点検'),
      { closed: false, from: '2026-11-04', hours: [{ opens: '12:00', closes: '15:00' }] },
    ]);
    expect(boundaries(s, '2026-11-02', '2026-11-03').map(describeBoundary)).toEqual([
      'main: 臨時休業 2026-11-03（設備点検） が始まります',
    ]);
    // 1 日の案内が終わり、次の案内が始まる日は 2 件
    expect(boundaries(s, '2026-11-03', '2026-11-04').map((b) => b.reason)).toEqual([
      'ended',
      'starts',
    ]);
    expect(boundaries(s, '2026-11-03', '2026-11-04').map(describeBoundary)[1]).toContain(
      '臨時の営業時間 2026-11-04 が始まります',
    );
  });

  it('何日も作り直していなければ、その間の境目をまとめて出す', () => {
    const s = store([closed('2026-12-29', '2027-01-03'), closed('2027-02-11')]);
    expect(boundaries(s, '2026-12-01', '2027-02-11')).toHaveLength(2);
  });

  it('境目があれば作り直しを求め、終了コード 10 を返す', () => {
    const period = { since: '2026-12-28', today: '2026-12-29' };
    const found = boundaries(
      store([closed('2026-12-29', '2027-01-03')]),
      period.since,
      period.today,
    );
    expect(refreshDecision(found, period)).toEqual({
      refresh: true,
      code: 10,
      message:
        '2026-12-28 から 2026-12-29 までに表示が変わります。サイトを作り直してください（1 件）',
    });
    expect(refreshDecision([], period)).toMatchObject({ refresh: false, code: 0 });
  });

  it('期間の指定が逆なら、黙って何も返さずに止める', () => {
    expect(() => boundaries(store([]), '2026-12-29', '2026-12-28')).toThrow('today 以前');
  });
});

describe('refresh コマンド', () => {
  const run = (...args: string[]) =>
    spawnSync('node', ['--import', 'tsx', join(ROOT, 'tools/ops/cli/refresh.ts'), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    });

  it('紬の店舗情報には臨時の案内がないので、作り直しは要らない（終了コード 0）', () => {
    const result = run('--today', '2026-12-29');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('日付で変わる表示はありません');
  });

  it('日付の指定が正しくなければ、使い方を出して終了コード 2', () => {
    const result = run('--today', '2026/12/29');
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--today は YYYY-MM-DD');
  });
});
