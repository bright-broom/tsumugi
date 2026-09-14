import { getMessages } from '@/i18n/catalog';
import { format } from '@/i18n/format';
const copy = getMessages().prices;
/** 公開価格の唯一の正本。金額は税別円。キーで参照する。 */
const TAX_RATE = 0.1;
export const EXTERNAL_MONTHLY_ESTIMATE = 3500;
const PAYMENT_DEPOSIT_RATE = 0.5;
export const SINGLE = {
  key: 'single',
  name: copy.singleName,
  pages: 1,
  price: 79800,
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
    recommended: true,
    preparing: false,
    lede: copy.buildLede,
    includes: [
      copy.singleIncludes,
      copy.singleIncludes2,
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
    recommended: false,
    preparing: true,
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
] as const;
export const RUN = [
  {
    key: 'run_self',
    name: copy.selfName,
    price: 0,
    minutes: 0,
    lede: copy.selfLede,
    includes: [copy.selfIncludes, copy.selfIncludes2],
  },
  {
    key: 'run_light',
    name: copy.runName,
    price: 4800,
    minutes: 0,
    lede: copy.runLede,
    includes: [copy.runIncludes2, copy.runIncludes3, copy.runIncludes4, copy.careExclusion],
  },
  {
    key: 'run_basic',
    name: copy.runNameBasic,
    price: 9800,
    minutes: 30,
    recommended: true,
    lede: copy.runLede2,
    includes: [copy.careIncluded, copy.runIncludes, copy.runIncludes5, copy.runIncludes6],
  },
  {
    key: 'run_standard',
    name: copy.runNameStandard,
    price: 29800,
    minutes: 90,
    lede: copy.runLede3,
    includes: [
      copy.careIncluded,
      copy.runIncludes7,
      copy.runIncludes8,
      copy.runIncludes9,
      copy.runIncludes10,
      copy.runIncludes11,
    ],
  },
] as const;
export const RUN_TERM = copy.runTerm;
export type BuildKey = (typeof BUILD)[number]['key'];
export type RunKey = (typeof RUN)[number]['key'];
export function build(key: BuildKey) {
  const p = BUILD.find((p) => p.key === key);
  if (!p) throw new Error(`unknown build plan: ${key}`);
  return p;
}
export function run(key: RunKey) {
  const p = RUN.find((p) => p.key === key);
  if (!p) throw new Error(`unknown run plan: ${key}`);
  return p;
}
export const productionPlans = () => [SINGLE, ...BUILD];
export function paymentSchedule(price: number) {
  const deposit = Math.floor(price * PAYMENT_DEPOSIT_RATE);
  return { deposit, acceptance: price - deposit, total: price };
}
export const withTax = (price: number) => Math.round(price * (1 + TAX_RATE));
export function supportMonthlyTotal(key: RunKey) {
  return run(key).price + EXTERNAL_MONTHLY_ESTIMATE;
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
export const SUBS_SOURCE = copy.comparisonSource;

export const SUBS_MARKET = [
  { name: copy.comparisonName, pages: 1, init: 5_000, monthly: 9_800 },
  { name: copy.comparisonName2, pages: 6, init: 5_000, monthly: 14_800 },
  { name: copy.comparisonName3, pages: 12, init: 5_000, monthly: 19_800 },
] as const;

export const subsTotal = (m: (typeof SUBS_MARKET)[number], months = COMPARE_MONTHS) =>
  m.init + m.monthly * months;

export const oursTotal = (price: number, runKey: RunKey, months = COMPARE_MONTHS) =>
  price + supportMonthlyTotal(runKey) * months;

export const yen = (n: number) =>
  format(copy.yen, { nToLocaleStringEnUS: n.toLocaleString('en-US') });

export const FREE_ITEMS = [
  { name: copy.freeItemName, market: copy.freeItemMarket },
  { name: copy.singleIncludes6, market: copy.freeItemMarket2 },
  { name: copy.freeItemName2, market: copy.freeItemMarket3 },
  { name: copy.freeItemName3, market: copy.freeItemMarket4 },
  { name: copy.freeItemName4, market: copy.freeItemMarket5 },
] as const;

/** ここから下は、月次変更の範囲・補助金などの定義。ページには必ずここから引く（手で書き写さない） */
export const UPDATE_IN = [
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
export const UPDATE_OUT: [name: string, detail: string, price: string][] = [
  [copy.unlimitedExcluded, copy.unlimitedExcluded2, copy.unlimitedExcluded3],
  [copy.unlimitedExcluded4, copy.unlimitedExcluded5, copy.unlimitedExcluded6],
  [copy.unlimitedExcluded7, copy.unlimitedExcluded8, copy.unlimitedExcluded6],
  [copy.unlimitedExcluded9, copy.unlimitedExcluded10, copy.unlimitedExcluded6],
  [copy.unlimitedExcluded11, '—', copy.unlimitedExcluded12],
  [copy.unlimitedExcluded13, copy.unlimitedExcluded14, copy.unlimitedExcluded15],
];
export const UPDATE_NOTE = copy.unlimitedNote;

/** ページ数の近いものどうしを並べる。当方が高い行も、そのまま出す */
export function compareRows(months = COMPARE_MONTHS) {
  const pairs: [(typeof SUBS_MARKET)[number], number, RunKey, string, number][] = [
    [SUBS_MARKET[0]!, SINGLE.price, 'run_light', SINGLE.name, SINGLE.pages],
    [SUBS_MARKET[1]!, build('basic').price, 'run_light', build('basic').name, build('basic').pages],
    [
      SUBS_MARKET[2]!,
      build('standard').price,
      'run_light',
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
      our_external: EXTERNAL_MONTHLY_ESTIMATE,
      our_total: ot,
      diff: ot - st,
    };
  });
}

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
    [copy.subsidyPackage, copy.subsidyPackage2, build('basic').price],
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
  [copy.portalBasic, 27_500],
  [copy.portalLight, 11_000],
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
