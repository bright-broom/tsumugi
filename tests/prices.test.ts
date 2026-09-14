import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  compareRows,
  productionPlans,
  RUN,
  paymentSchedule,
  supportMonthlyTotal,
  withTax,
} from '@/content/prices';
import { rnd } from '@/lib/round';

describe('料金の参照と比較', () => {
  it('社内モデルと公開料金・作業枠が一致する', () => {
    const model = JSON.parse(
      readFileSync(new URL('../tools/pricing/proposal.json', import.meta.url), 'utf8'),
    );
    expect(productionPlans().map((p) => p.price)).toEqual(
      model.builds.map((p: { price: number }) => p.price),
    );
    expect(RUN.map((p) => [p.price, p.minutes])).toEqual(
      model.support.map((p: { price: number; workMinutes: number }) => [p.price, p.workMinutes]),
    );
  });
  it('着手と検収で制作本体の全額を支払う', () => {
    for (const plan of productionPlans()) {
      const { deposit, acceptance, total } = paymentSchedule(plan.price);
      expect(deposit).toBe(plan.price / 2);
      expect(deposit + acceptance).toBe(total);
      expect(total).toBe(plan.price);
    }
  });
  it('継続支援なしでも外部費が残り、税込の比較は税を揃える', () => {
    expect(supportMonthlyTotal('run_self')).toBe(3500);
    expect(supportMonthlyTotal('run_basic')).toBe(13300);
    expect(withTax(supportMonthlyTotal('run_basic'))).toBe(14630);
  });
  it('36か月の総額は外部費を含め、不利な比較も残す', () => {
    expect(compareRows().map(({ our_total, diff }) => [our_total, diff])).toEqual([
      [378600, 20800],
      [496800, -41000],
      [696800, -21000],
    ]);
  });
  it('運用期間ゼロでは制作費だけを比較する', () => {
    expect(compareRows(0).map(({ our_total }) => our_total)).toEqual([79800, 198000, 398000]);
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
