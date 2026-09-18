import { unitEconomics, portfolio, customerTotal, clientTrajectory } from './model';
import model from './proposal.json';
const report = {
  version: model.version,
  unitEconomics: [...model.builds, ...model.support].map((p) => ({
    key: p.key,
    ...unitEconomics(p, model.assumptions),
  })),
  base: portfolio(model),
  deliveryOverrun25Percent: portfolio(model, { hourMultiplier: 1.25 }),
  extraSupport30Minutes: portfolio(model, { extraMinutesPerSupport: 30 }),
  combinedStress: portfolio(model, { hourMultiplier: 1.25, extraMinutesPerSupport: 30 }),
  comparisons36Months: model.builds.map((p) => ({
    key: p.key,
    ...customerTotal(model, { buildKey: p.key }),
  })),
  clientsByMonth: clientTrajectory(
    2 * model.assumptions.supportConversion,
    model.assumptions.monthlyChurn,
    36,
  ),
};
console.log(JSON.stringify(report, null, 2));
