import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  portfolio,
  customerTotal,
  unitEconomics,
  clientTrajectory,
  requiredBenefit,
} from './model';
import model from './proposal.json';
test('140 hours includes sales and reserves; full owner-time cost is not double counted', () => {
  const p = portfolio(model);
  assert.equal(p.deliveryCapacity, 84);
  assert.equal(p.hours, 61);
  assert.equal(p.headroom, 23);
  assert.equal(p.revenue, 800000);
  assert.equal(p.mrr, 300000);
  assert.equal(p.clients, 22);
  assert.equal(p.surplusAfterOwnerTime, p.revenue - p.variableCash - 750000);
});
test('combined delivery and support stress prevents further commitments', () => {
  const p = portfolio(model, { hourMultiplier: 1.25, extraMinutesPerSupport: 30 });
  assert.equal(p.hours, 87.25);
  assert.equal(p.feasible, false);
});
test('extra support time is counted across every paying client', () => {
  assert.equal(portfolio(model, { extraMinutesPerSupport: 30 }).headroom, 12);
});
test('no sales still carries the full monthly time and fixed-cost budget', () => {
  const p = portfolio(model, { buildCounts: {}, supportCounts: {} });
  assert.equal(p.revenue, 0);
  assert.equal(p.surplusAfterOwnerTime, -750000);
});
test('price floor detects high acquisition costs, instead of subsidizing them from future renewals', () => {
  const plan = model.builds.find((p) => p.key === 'core');
  assert.ok(plan);
  const base = unitEconomics(plan, model.assumptions);
  assert.ok(base.margin !== null && base.margin >= 0.5);
  const high = unitEconomics({ ...plan, cashAcquisitionCost: 40000 }, model.assumptions);
  assert.ok(high.minimumPrice > 198000);
});
test('comparison includes external hosting costs and retains unfavorable rows', () => {
  assert.equal(customerTotal(model, { buildKey: 'entry', supportKey: 'care' }).difference, 84200);
  assert.equal(customerTotal(model, { buildKey: 'core', supportKey: 'care' }).ourTotal, 592000);
  assert.equal(customerTotal(model, { buildKey: 'core', supportKey: 'care' }).difference, 54200);
  assert.equal(customerTotal(model, { buildKey: 'core', supportKey: 'care' }).breakEvenMonth, 47);
  assert.equal(
    customerTotal(model, { buildKey: 'core', supportKey: 'improve' }).breakEvenMonth,
    null,
  );
  assert.equal(customerTotal(model, { months: 1 }).comparisonTotal, 93800);
});
test('churn curve includes an unreachable steady-state target', () => {
  const fastChurn = clientTrajectory(1.5, 0.05, 120);
  const fastFinal = fastChurn.at(-1);
  assert.ok(fastFinal !== undefined && fastFinal < 30);
  const slowFinal = clientTrajectory(1.5, 0.02, 28).at(-1);
  assert.ok(slowFinal !== undefined && slowFinal >= 32);
  assert.equal(clientTrajectory(1.5, 0, 12).at(-1), 18);
});
test('return threshold uses contribution per additional sale, not revenue', () => {
  assert.deepEqual(requiredBenefit(198000, 13300, 24, 10000), {
    monthlyCost: 21550,
    additionalSales: 3,
  });
});
test('invalid inputs cannot produce attractive but meaningless results', () => {
  assert.throws(() => portfolio(model, { supportCounts: { unknown: 1 } }));
  assert.throws(() => portfolio(model, { supportCounts: { care: -1 } }));
  assert.throws(() => customerTotal(model, { months: 1.5 }));
  assert.throws(() => requiredBenefit(1, 1, 12, 0));
  assert.throws(() => clientTrajectory(1, 1.1, 12));
});
test('a missing comparison tariff is rejected instead of returning NaN', () => {
  const incompleteModel = {
    ...model,
    competitorReference: { ...model.competitorReference, monthly: { entry: 9800 } },
  };
  assert.throws(() => customerTotal(incompleteModel, { buildKey: 'core' }), {
    name: 'RangeError',
    message: 'missing comparison price: core',
  });
});
test('care scope keeps the modeled 50% contribution floor and the 140-hour capacity', () => {
  const care = model.support.find((p) => p.key === 'care');
  assert.ok(care);
  const unit = unitEconomics(care, model.assumptions);
  assert.equal(care.price, 6000);
  assert.equal(unit.minimumPrice, 5958);
  assert.ok(unit.margin !== null && unit.margin >= model.assumptions.targetContributionMargin);
  assert.equal(unit.contribution, 3020);
  assert.equal(portfolio(model).headroom, 23);
  assert.ok(
    customerTotal(model, { buildKey: 'entry', supportKey: 'care', months: 6 }).difference > 0,
  );
});

test('default comparison uses production only with customer-paid external costs', () => {
  const total = customerTotal(model, { buildKey: 'entry' });
  assert.equal(total.ourTotal, 226000);
  assert.equal(total.difference, -131800);
  assert.equal(customerTotal(model, { buildKey: 'core' }).ourTotal, 376000);
  assert.equal(customerTotal(model, { buildKey: 'expand' }).ourTotal, 576000);
  assert.equal(customerTotal(model, { buildKey: 'entry', supportKey: 'care' }).ourTotal, 442000);
});
