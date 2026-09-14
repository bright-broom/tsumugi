import { describe, expect, it } from 'vitest';
import { compareRows, monthlyAllIn, totalInstallment } from '@/content/prices';
import { rnd } from '@/lib/round';

describe('料金の参照と比較', () => {
  it('運用プランをキーで選び、追加プランが既存料金をずらさない', () => {
    expect(monthlyAllIn('standard', 'run_standard')).toBe(28000);
    expect(monthlyAllIn('basic', 'run_basic')).toBe(16800);
  });
  it('分割払いの総額が買い切り額と一致する', () => {
    for (const key of ['basic', 'standard', 'pro'] as const) {
      const [total, price] = totalInstallment(key);
      expect(total).toBe(price);
    }
  });
  it('36か月比較では高い行もそのまま残す', () => {
    expect(compareRows().map(({ our_total, diff }) => [our_total, diff])).toEqual([
      [248600, -109200],
      [550800, 13000],
      [974000, 256200],
    ]);
  });
  it('運用期間ゼロでは制作費だけを比較する', () => {
    expect(compareRows(0).map(({ our_total }) => our_total)).toEqual([39800, 198000, 398000]);
  });
});

it.each([
  [212.5, 212],
  [213.5, 214],
  [-2.5, -2],
  [-1.5, -2],
  [2.49, 2],
  [2.51, 3],
])('図の寸法を移行前と同じ偶数丸めにする: %s → %s', (input, expected) => {
  expect(rnd(input!)).toBe(expected);
});
