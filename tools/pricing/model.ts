// Internal decision model. Public tariffs remain in src/content/prices.ts.
interface Plan {
  key: string;
  price: number;
  hours: number;
  cashCost: number;
  cashAcquisitionCost?: number;
}

interface Assumptions {
  monthlyHours: number;
  adminHours: number;
  reserveHours: number;
  hourlyCost: number;
  fixedMonthlyCost: number;
  paymentFeeRate: number;
  targetContributionMargin: number;
  externalMonthlyEstimate: number;
}

type Counts = Readonly<Record<string, number>>;

interface PricingModel {
  assumptions: Assumptions;
  builds: readonly Plan[];
  support: readonly Plan[];
  portfolio: { buildCounts: Counts; supportCounts: Counts };
  competitorReference: {
    initial: number;
    minimumMonths: number;
    monthly: Readonly<Record<string, number>>;
  };
}

interface PortfolioOptions {
  assumptions?: Partial<Assumptions>;
  hourMultiplier?: number;
  extraMinutesPerSupport?: number;
  buildCounts?: Counts;
  supportCounts?: Counts;
}

interface CustomerTotalOptions {
  buildKey?: string;
  supportKey?: string;
  months?: number;
  externalMonthly?: number;
  oneOffExtras?: number;
  comparisonExtras?: number;
}

const number = (value: number, name: string, min = 0) => {
  if (!Number.isFinite(value) || value < min) throw new RangeError(`${name}: invalid value`);
  return value;
};
const fraction = (value: number, name: string, exclusive = false) => {
  number(value, name);
  if (exclusive ? value >= 1 : value > 1) throw new RangeError(`${name}: invalid rate`);
  return value;
};
const byKey = (rows: readonly Plan[], key: string) => {
  const row = rows.find((p) => p.key === key);
  if (!row) throw new RangeError(`unknown plan: ${key}`);
  return row;
};
export function unitEconomics(
  plan: Plan,
  assumptions: Pick<Assumptions, 'hourlyCost' | 'paymentFeeRate' | 'targetContributionMargin'>,
  hourMultiplier = 1,
) {
  number(plan.price, 'price');
  number(plan.hours, 'hours');
  number(assumptions.hourlyCost, 'hourlyCost');
  number(hourMultiplier, 'hourMultiplier');
  fraction(assumptions.paymentFeeRate, 'paymentFeeRate', true);
  fraction(assumptions.targetContributionMargin, 'targetContributionMargin', true);
  const labor = plan.hours * hourMultiplier * assumptions.hourlyCost;
  const cash =
    number(plan.cashCost, 'cashCost') +
    number(plan.cashAcquisitionCost ?? 0, 'cashAcquisitionCost');
  const fee = plan.price * assumptions.paymentFeeRate;
  const contribution = plan.price - labor - cash - fee;
  const denominator = 1 - assumptions.paymentFeeRate - assumptions.targetContributionMargin;
  if (denominator <= 0) throw new RangeError('target margin plus fees must be below 100%');
  return {
    labor,
    cash,
    fee,
    contribution,
    margin: plan.price ? contribution / plan.price : null,
    minimumPrice: Math.ceil((labor + cash) / denominator),
  };
}
export function portfolio(model: PricingModel, options: PortfolioOptions = {}) {
  const a = { ...model.assumptions, ...options.assumptions };
  for (const key of [
    'monthlyHours',
    'adminHours',
    'reserveHours',
    'hourlyCost',
    'fixedMonthlyCost',
  ] as const)
    number(a[key], key);
  const multiplier = options.hourMultiplier ?? 1;
  const extraMinutes = number(options.extraMinutesPerSupport ?? 0, 'extraMinutesPerSupport');
  const b = options.buildCounts ?? model.portfolio.buildCounts;
  const s = options.supportCounts ?? model.portfolio.supportCounts;
  let revenue = 0,
    mrr = 0,
    hours = 0,
    variableCash = 0,
    clients = 0;
  for (const [rows, counts, recurring] of [
    [model.builds, b, false],
    [model.support, s, true],
  ] as const) {
    for (const [key, count] of Object.entries(counts)) {
      number(count, key);
      if (!Number.isInteger(count)) throw new RangeError('client counts must be integers');
      const p = byKey(rows, key);
      const unit = unitEconomics(p, a, multiplier);
      revenue += p.price * count;
      variableCash += (unit.cash + unit.fee) * count;
      hours += p.hours * multiplier * count;
      if (recurring && p.price > 0) {
        mrr += p.price * count;
        clients += count;
        hours += (count * extraMinutes) / 60;
      }
    }
  }
  const deliveryCapacity = a.monthlyHours - a.adminHours - a.reserveHours;
  const headroom = deliveryCapacity - hours;
  // Full monthly owner-time allowance is counted once, including idle/admin/reserve time.
  const ownerTimeAllowance = a.monthlyHours * a.hourlyCost;
  return {
    revenue,
    mrr,
    hours,
    clients,
    deliveryCapacity,
    headroom,
    feasible: headroom >= 0,
    variableCash,
    ownerTimeAllowance,
    cashBeforeOwnerPay: revenue - variableCash - a.fixedMonthlyCost,
    surplusAfterOwnerTime: revenue - variableCash - a.fixedMonthlyCost - ownerTimeAllowance,
  };
}
export function customerTotal(model: PricingModel, options: CustomerTotalOptions = {}) {
  const build = byKey(model.builds, options.buildKey ?? 'core');
  const support = byKey(model.support, options.supportKey ?? 'care');
  const months = options.months ?? 36;
  if (!Number.isInteger(months) || months < 0)
    throw new RangeError('months must be a nonnegative integer');
  const external = number(
    options.externalMonthly ?? model.assumptions.externalMonthlyEstimate,
    'externalMonthly',
  );
  const extras = number(options.oneOffExtras ?? 0, 'oneOffExtras');
  const comparisonExtras = number(options.comparisonExtras ?? 0, 'comparisonExtras');
  const ourTotal = build.price + extras + months * (support.price + external);
  const ref = model.competitorReference;
  const refMonthly = ref.monthly[build.key];
  if (refMonthly === undefined) throw new RangeError(`missing comparison price: ${build.key}`);
  const comparisonTotal =
    ref.initial + Math.max(months, ref.minimumMonths) * refMonthly + comparisonExtras;
  const monthlySaving = refMonthly - support.price - external;
  // Equal spend including the reference's minimum contract period; scope is not equivalent.
  let breakEvenMonth: number | null = null;
  for (let m = 1; m <= 120; m++) {
    if (
      build.price + extras + m * (support.price + external) <=
      ref.initial + Math.max(m, ref.minimumMonths) * refMonthly + comparisonExtras
    ) {
      breakEvenMonth = m;
      break;
    }
  }
  return {
    ourTotal,
    comparisonTotal,
    difference: ourTotal - comparisonTotal,
    monthlySaving,
    breakEvenMonth,
  };
}
export function clientTrajectory(newClients: number, churn: number, months: number, start = 0) {
  number(newClients, 'newClients');
  fraction(churn, 'churn');
  number(start, 'start');
  if (!Number.isInteger(months) || months < 0)
    throw new RangeError('months must be a nonnegative integer');
  const result = [start];
  let clients = start;
  for (let m = 1; m <= months; m++) {
    clients = clients * (1 - churn) + newClients;
    result.push(clients);
  }
  return result;
}
export function requiredBenefit(
  initial: number,
  monthlyServiceAndExternal: number,
  periodMonths: number,
  valuePerIncrementalSale: number,
) {
  number(initial, 'initial');
  number(monthlyServiceAndExternal, 'monthlyServiceAndExternal');
  number(periodMonths, 'periodMonths', 1);
  number(valuePerIncrementalSale, 'valuePerIncrementalSale', Number.MIN_VALUE);
  const monthlyCost = initial / periodMonths + monthlyServiceAndExternal;
  return { monthlyCost, additionalSales: Math.ceil(monthlyCost / valuePerIncrementalSale) };
}
