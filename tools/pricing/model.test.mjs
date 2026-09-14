import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { portfolio, customerTotal, unitEconomics, clientTrajectory, requiredBenefit } from './model.mjs';
const model = JSON.parse(readFileSync(new URL('./proposal.json', import.meta.url), 'utf8'));
test('140 hours includes sales and reserves; full owner-time cost is not double counted', () => {
  const p = portfolio(model);
  assert.equal(p.deliveryCapacity, 84); assert.equal(p.hours, 69.5); assert.equal(p.headroom, 14.5);
  assert.equal(p.revenue, 979600); assert.equal(p.mrr, 383600); assert.equal(p.clients, 32);
  assert.equal(p.surplusAfterOwnerTime, p.revenue - p.variableCash - 750000);
});
test('25% delivery overrun prevents further commitments', () => {
  const p = portfolio(model, { hourMultiplier: 1.25 });
  assert.equal(p.hours, 86.875); assert.equal(p.feasible, false);
});
test('extra support time is counted across every paying client', () => {
  assert.equal(portfolio(model, { extraMinutesPerSupport: 30 }).headroom, -1.5);
});
test('no sales still carries the full monthly time and fixed-cost budget', () => {
  const p = portfolio(model, { buildCounts: {}, supportCounts: {} });
  assert.equal(p.revenue, 0); assert.equal(p.surplusAfterOwnerTime, -750000);
});
test('price floor detects high acquisition costs, instead of subsidizing them from future renewals', () => {
  const base = unitEconomics(model.builds.find(p => p.key === 'core'), model.assumptions);
  assert.ok(base.margin >= 0.5);
  const high = unitEconomics({ ...model.builds.find(p => p.key === 'core'), cashAcquisitionCost: 40000 }, model.assumptions);
  assert.ok(high.minimumPrice > 198000);
});
test('comparison includes external hosting costs and retains unfavorable rows', () => {
  assert.equal(customerTotal(model, { buildKey: 'entry', supportKey: 'care' }).difference, 20800);
  assert.equal(customerTotal(model, { buildKey: 'core', supportKey: 'care' }).ourTotal, 496800);
  assert.equal(customerTotal(model, { buildKey: 'core', supportKey: 'care' }).difference, -41000);
  assert.equal(customerTotal(model, { buildKey: 'core', supportKey: 'care' }).breakEvenMonth, 30);
  assert.equal(customerTotal(model, { buildKey: 'core', supportKey: 'improve' }).breakEvenMonth, null);
  assert.equal(customerTotal(model, { months: 1 }).comparisonTotal, 93800);
});
test('churn curve includes an unreachable steady-state target', () => {
  const fastChurn = clientTrajectory(1.5, 0.05, 120);
  assert.ok(fastChurn.at(-1) < 30);
  assert.ok(clientTrajectory(1.5, 0.02, 28).at(-1) >= 32);
  assert.equal(clientTrajectory(1.5, 0, 12).at(-1), 18);
});
test('return threshold uses contribution per additional sale, not revenue', () => {
  assert.deepEqual(requiredBenefit(198000, 13300, 24, 10000), { monthlyCost: 21550, additionalSales: 3 });
});
test('invalid inputs cannot produce attractive but meaningless results', () => {
  assert.throws(() => portfolio(model, { supportCounts: { unknown: 1 } }));
  assert.throws(() => portfolio(model, { supportCounts: { care: -1 } }));
  assert.throws(() => customerTotal(model, { months: 1.5 }));
  assert.throws(() => requiredBenefit(1, 1, 12, 0));
  assert.throws(() => clientTrajectory(1, 1.1, 12));
});
