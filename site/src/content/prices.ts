import { getMessages } from '@/i18n/catalog';
const copy = getMessages().prices;
import { format } from '@/i18n/format';
/**
 * 価格の単一の出所（Single Source of Truth）。
 * 金額はすべて税別（円）。
 *
 * `as const` を付けているので、値から型が自動で付く。
 * 添字（RUN[1] など）では引かない ── プランを1つ足したときに
 * 全ページの月額が静かに下振れした事故があるため、必ず key で引く。
 */

export const SINGLE = {
  key: 'single',
  name: copy.singleName,
  pages: 1,
  price: 39_800,
  weeks: 2,
  lede: copy.singleLede,
  includes: [
    copy.singleIncludes,
    copy.singleIncludes2,
    copy.singleIncludes3,
    copy.singleIncludes4,
    copy.singleIncludes5,
    copy.singleIncludes6,
  ],
  notIncludes: [copy.singleNotIncludes, copy.singleNotIncludes2],
} as const;

export const BUILD = [
  {
    key: 'basic',
    name: copy.buildName,
    pages: 6,
    price: 198000,
    weeks: 4,
    lede: copy.buildLede,
    includes: [
      copy.singleIncludes,
      copy.singleIncludes2,
      copy.buildIncludes,
      copy.buildIncludes2,
      copy.buildIncludes3,
      copy.buildIncludes4,
      copy.buildIncludes5,
      copy.singleIncludes6,
    ],
  },
  {
    key: 'standard',
    name: copy.buildName2,
    pages: 9,
    price: 398000,
    weeks: 6,
    recommended: true,
    lede: copy.buildLede2,
    includes: [
      copy.buildIncludes6,
      copy.buildIncludes7,
      copy.buildIncludes8,
      copy.buildIncludes9,
      copy.buildIncludes10,
      copy.buildIncludes11,
    ],
  },
  {
    key: 'pro',
    name: copy.buildName3,
    pages: 14,
    price: 698000,
    weeks: 10,
    lede: copy.buildLede3,
    includes: [
      copy.buildIncludes12,
      copy.buildIncludes13,
      copy.buildIncludes14,
      copy.buildIncludes15,
      copy.buildIncludes16,
      copy.buildIncludes17,
      copy.buildIncludes18,
    ],
  },
] as const;

export const INSTALLMENT_COUNT = 24;
export const INSTALLMENT = {
  basic: { initial: 30_000, monthly: 7_000 },
  standard: { initial: 110_000, monthly: 12_000 },
  pro: { initial: 218_000, monthly: 20_000 },
} as const;

export const RUN = [
  {
    key: 'run_light',
    name: copy.runName,
    price: 5800,
    lede: copy.runLede,
    includes: [copy.runIncludes, copy.runIncludes2, copy.runIncludes3, copy.runIncludes4],
  },
  {
    key: 'run_basic',
    name: copy.buildName,
    price: 9800,
    lede: copy.runLede2,
    includes: [
      copy.runIncludes,
      copy.runIncludes2,
      copy.runIncludes3,
      copy.runIncludes4,
      copy.runIncludes5,
      copy.runIncludes6,
    ],
  },
  {
    key: 'run_standard',
    name: copy.buildName2,
    price: 16000,
    recommended: true,
    lede: copy.runLede3,
    includes: [
      copy.buildIncludes6,
      copy.runIncludes7,
      copy.runIncludes8,
      copy.runIncludes9,
      copy.runIncludes10,
      copy.runIncludes11,
    ],
  },
  {
    key: 'run_growth',
    name: copy.runName2,
    price: 29800,
    lede: copy.runLede4,
    includes: [
      copy.buildIncludes12,
      copy.runIncludes12,
      copy.runIncludes13,
      copy.runIncludes14,
      copy.runIncludes15,
      copy.runIncludes16,
    ],
  },
] as const;
export const RUN_TERM = copy.runTerm;

export type BuildKey = (typeof BUILD)[number]['key'];
export type RunKey = (typeof RUN)[number]['key'];

export function build(key: BuildKey) {
  const b = BUILD.find((p) => p.key === key);
  if (!b) throw new Error(`unknown build plan: ${key}`);
  return b;
}

export function run(key: RunKey) {
  const r = RUN.find((p) => p.key === key);
  if (!r) throw new Error(`unknown run plan: ${key}`);
  return r;
}

export const OPTIONS = [
  { name: copy.optionName, price: 33000, note: copy.optionNote },
  { name: copy.buildIncludes, price: 55000, note: copy.optionNote2 },
  { name: copy.buildIncludes14, price: 88000, note: copy.optionNote3 },
  { name: copy.optionName2, price: 88000, note: '—' },
  { name: copy.optionName3, price: 55000, note: copy.optionNote4 },
  { name: copy.optionName4, price: 198000, note: copy.optionNote5 },
  { name: copy.optionName5, price: 55000, note: copy.optionNote6 },
  { name: copy.optionName6, price: 165000, note: '—' },
] as const;

// ── 月額制（サブスク型）との総額比較 ────────────────
// 金額は各社が公開している料金ページの表示値。サイトに他社名は書かない。
export const COMPARE_MONTHS = 36;
export const SUBS_TRANSFER_MONTHS = 36;
export const SUBS_MIN_TERM = 6;
export const SUBS_SOURCE = copy.comparisonSource;

export const SUBS_MARKET = [
  { name: copy.comparisonName, pages: 1, init: 5_000, monthly: 9_800 },
  { name: copy.comparisonName2, pages: 6, init: 5_000, monthly: 14_800 },
  { name: copy.comparisonName3, pages: 12, init: 5_000, monthly: 19_800 },
] as const;

export const subsTotal = (m: (typeof SUBS_MARKET)[number], months = COMPARE_MONTHS) =>
  m.init + m.monthly * months;

export const oursTotal = (price: number, runKey: RunKey, months = COMPARE_MONTHS) =>
  price + run(runKey).price * months;

export const monthlyAllIn = (buildKey: keyof typeof INSTALLMENT, runKey: RunKey) =>
  INSTALLMENT[buildKey].monthly + run(runKey).price;

export const yen = (n: number) =>
  format(copy.yen, { nToLocaleStringEnUS: n.toLocaleString('en-US') });

export const FREE_ITEMS = [
  { name: copy.freeItemName, market: copy.freeItemMarket },
  { name: copy.singleIncludes6, market: copy.freeItemMarket2 },
  { name: copy.freeItemName2, market: copy.freeItemMarket3 },
  { name: copy.freeItemName3, market: copy.freeItemMarket4 },
  { name: copy.freeItemName4, market: copy.freeItemMarket5 },
] as const;
export const MARKET_SPOT = [
  { name: copy.marketSpotName, price: copy.marketSpotPrice },
  { name: copy.marketSpotName2, price: copy.marketSpotPrice2 },
  { name: copy.marketSpotName3, price: copy.marketSpotPrice3 },
  { name: copy.marketSpotName4, price: copy.marketSpotPrice4 },
] as const;

/** ここから下は、変更し放題の範囲・補助金などの定義。ページには必ずここから引く（手で書き写さない） */
export const UNLIMITED_IN = [
  copy.unlimitedIncluded,
  copy.unlimitedIncluded2,
  copy.unlimitedIncluded3,
  copy.unlimitedIncluded4,
  copy.unlimitedIncluded5,
  copy.unlimitedIncluded6,
  copy.unlimitedIncluded7,
  copy.unlimitedIncluded8,
  copy.unlimitedIncluded9,
] as const;
export const UNLIMITED_OUT: [name: string, detail: string, price: string][] = [
  [copy.unlimitedExcluded, copy.unlimitedExcluded2, copy.unlimitedExcluded3],
  [copy.unlimitedExcluded4, copy.unlimitedExcluded5, copy.unlimitedExcluded6],
  [copy.unlimitedExcluded7, copy.unlimitedExcluded8, copy.unlimitedExcluded6],
  [copy.unlimitedExcluded9, copy.unlimitedExcluded10, copy.unlimitedExcluded6],
  [copy.unlimitedExcluded11, '—', copy.unlimitedExcluded12],
  [copy.unlimitedExcluded13, copy.unlimitedExcluded14, copy.unlimitedExcluded15],
];
export const UNLIMITED_NOTE = copy.unlimitedNote;

/** ページ数の近いものどうしを並べる。当方が高い行も、そのまま出す */
export function compareRows(months = COMPARE_MONTHS) {
  const pairs: [(typeof SUBS_MARKET)[number], number, RunKey, string, number][] = [
    [SUBS_MARKET[0]!, SINGLE.price, 'run_light', SINGLE.name, SINGLE.pages],
    [SUBS_MARKET[1]!, build('basic').price, 'run_basic', build('basic').name, build('basic').pages],
    [
      SUBS_MARKET[2]!,
      build('standard').price,
      'run_standard',
      build('standard').name,
      build('standard').pages,
    ],
  ];
  return pairs.map(([sub, price, runKey, name, pages]) => {
    const st = subsTotal(sub, months);
    const ot = oursTotal(price, runKey, months);
    return {
      sub_name: sub.name,
      sub_pages: sub.pages,
      sub_monthly: sub.monthly,
      sub_total: st,
      our_name: name,
      our_pages: pages,
      our_price: price,
      our_run: run(runKey).price,
      our_total: ot,
      diff: ot - st,
    };
  });
}

/** シングルの買い切り額が、月額制の何か月分にあたるか */
export const singleVsSubsMonths = () => SINGLE.price / SUBS_MARKET[0]!.monthly;

/** 小規模事業者持続化補助金 */
export const SUBSIDY = {
  name: copy.subsidyName,
  round: copy.subsidyRound,
  rate_text: copy.subsidyRateText,
  cap: 500000,
  web_cap: 300000,
  deadline: copy.subsidyDeadline,
  form4_deadline: copy.subsidyForm4Deadline,
  adoption_rate: '47.2%',
  adoption_detail: copy.subsidyAdoptionDetail,
  package: [
    [copy.subsidyPackage, copy.subsidyPackage2, 398000],
    [copy.subsidyPackage3, copy.subsidyPackage4, 150000],
    [copy.subsidyPackage3, copy.subsidyPackage5, 100000],
    [copy.subsidyPackage3, copy.subsidyPackage6, 88000],
    [copy.subsidyPackage3, copy.subsidyPackage7, 64000],
  ] as [kind: string, detail: string, price: number][],
};

// ── ポータルサイトの掲載料（公開されている料金を税込に換算） ──
export const PORTAL_TABELOG: [name: string, monthly: number][] = [
  [copy.portal, 110_000],
  [copy.portal2, 55_000],
  [copy.buildName, 27_500],
  [copy.runName, 11_000],
  [copy.portal3, 0],
];
export const PORTAL_FEE_DINNER = 220; // 税込・1人あたり
export const PORTAL_FEE_LUNCH = 110;

/** 補助金の内訳。int() は Python と同じく切り捨てなので Math.floor でそろえる */
export function subsidyCalc() {
  const items = SUBSIDY.package;
  const sum = (f: (k: string) => boolean) =>
    items.filter(([k]) => f(k)).reduce((a, [, , v]) => a + v, 0);
  const total = sum(() => true);
  const web = sum((k) => k === copy.subsidyPackage);
  const pr = sum((k) => k === copy.subsidyPackage3);
  const webSub = Math.min(Math.floor((web * 2) / 3), SUBSIDY.web_cap);
  const prSub = Math.floor((pr * 2) / 3);
  const grant = Math.min(webSub + prSub, SUBSIDY.cap);
  return { total, web, pr, web_sub: webSub, pr_sub: grant - webSub, grant, net: total - grant };
}

/** 分割の総額と、買い切りの金額。ふたつが一致することを verify が見ている */
export const totalInstallment = (key: keyof typeof INSTALLMENT): [total: number, price: number] => [
  INSTALLMENT[key].initial + INSTALLMENT[key].monthly * INSTALLMENT_COUNT,
  build(key).price,
];
