/**
 * 店舗情報の型・検査・構造化データ（ADR 0056）。
 *
 * 1つの正本（StoreProfile）から、画面の店舗情報と JSON-LD の両方を作る。
 * 地図は埋め込まず、地図サービスへのリンクだけを持つ（実行時 JS 0 バイトを保つ）。
 */
import {
  assertNoErrors,
  daySpan,
  duplicates,
  eachDate,
  error,
  isHttpsUrl,
  isIsoDate,
  warning,
  type Industry,
  type IsoDate,
  type Issue,
} from '@/lib/storefront/core';

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
export type DayOfWeek = (typeof DAYS)[number];

/** 顧客に選んでもらう schema.org の型。LocalBusiness の下位型から、確認したものだけを足す。 */
export const BUSINESS_TYPES = [
  'LocalBusiness',
  'ProfessionalService',
  'FoodEstablishment',
  'Restaurant',
  'CafeOrCoffeeShop',
  'Bakery',
  'BarOrPub',
  'HealthAndBeautyBusiness',
  'HairSalon',
  'BeautySalon',
  'NailSalon',
  'DaySpa',
  'HomeAndConstructionBusiness',
  'GeneralContractor',
  'Electrician',
  'Plumber',
  'HousePainter',
  'RoofingContractor',
  'LegalService',
  'AccountingService',
  'Store',
  'AutoRepair',
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** 業種ごとの候補。先頭を既定にし、実際の業態に合わせて選び直す。 */
export const BUSINESS_TYPES_BY_INDUSTRY: Record<
  Industry,
  readonly [BusinessType, ...BusinessType[]]
> = {
  restaurant: ['Restaurant', 'CafeOrCoffeeShop', 'Bakery', 'BarOrPub', 'FoodEstablishment'],
  construction: [
    'GeneralContractor',
    'HomeAndConstructionBusiness',
    'Electrician',
    'Plumber',
    'HousePainter',
    'RoofingContractor',
  ],
  salon: ['HairSalon', 'BeautySalon', 'NailSalon', 'DaySpa', 'HealthAndBeautyBusiness'],
  professional: ['LegalService', 'AccountingService', 'ProfessionalService'],
};

/** `HH:MM`。閉店が開店より早い場合は日をまたぐ営業とみなす。 */
export interface TimeRange {
  opens: string;
  closes: string;
}
/** 曜日に区間が無い（または空）なら定休日。 */
export type WeeklyHours = Partial<Record<DayOfWeek, readonly TimeRange[]>>;

interface ExceptionDates {
  from: IsoDate;
  /** 省略すると from の1日だけ */
  to?: IsoDate;
  /** 年末年始・設備点検など、表示に添える理由 */
  note?: string;
}
/** 臨時休業、または通常と違う時間での営業。 */
export type HoursException =
  | (ExceptionDates & { closed: true })
  | (ExceptionDates & { closed: false; hours: readonly TimeRange[] });

export interface PostalAddress {
  postalCode: string;
  region: string;
  locality: string;
  street: string;
}

/** 来店を受ける拠点だけが持つ。所在地の案内に必要な項目を省略させない。 */
export interface Visit {
  access: string;
  parking: { available: boolean; note?: string };
  /** 地図サービスでその場所を開く URL（埋め込みは使わない） */
  mapUrl: string;
}

export interface StoreLocation {
  id: string;
  /** 複数拠点のときの拠点名。省略すると屋号 */
  name?: string;
  telephone: string;
  address: PostalAddress;
  hours: WeeklyHours;
  publicHolidays?: 'open' | 'closed';
  exceptions?: readonly HoursException[];
  visit?: Visit;
  /** 拠点ごとのページがあればその URL */
  url?: string;
  /** Google ビジネスプロフィール・SNS など、同じ拠点を表す外部のページ */
  sameAs?: readonly string[];
}

export interface AreaServed {
  type: 'Country' | 'State' | 'City' | 'AdministrativeArea';
  name: string;
}

export interface StoreProfile {
  name: string;
  description: string;
  url: string;
  businessType: BusinessType;
  language: string;
  /** 臨時休業の表示期限や日付の判定に使う（例: Asia/Tokyo） */
  timeZone: string;
  areaServed?: AreaServed | readonly AreaServed[];
  locations: readonly [StoreLocation, ...StoreLocation[]];
}

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_EXCEPTION_DAYS = 366;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const validRange = (range: TimeRange) =>
  TIME.test(range.opens) && (TIME.test(range.closes) || range.closes === '24:00');

function rangeIssues(ranges: readonly TimeRange[], path: string): Issue[] {
  const issues: Issue[] = [];
  ranges.forEach((range, index) => {
    if (!validRange(range)) issues.push(error('hours.invalid-time', `${path}[${index}]`));
    else if (range.opens === range.closes)
      issues.push(error('hours.empty-range', `${path}[${index}]`));
  });
  const sameDay = ranges
    .filter((range) => validRange(range) && minutes(range.closes) > minutes(range.opens))
    .toSorted((a, b) => minutes(a.opens) - minutes(b.opens));
  for (let i = 1; i < sameDay.length; i++)
    if (minutes(sameDay[i]!.opens) < minutes(sameDay[i - 1]!.closes))
      issues.push(error('hours.overlap', path));
  return issues;
}

function exceptionIssues(
  exceptions: readonly HoursException[],
  path: string,
  today: IsoDate | undefined,
): Issue[] {
  const issues: Issue[] = [];
  const claimed = new Set<IsoDate>();
  exceptions.forEach((exception, index) => {
    const at = `${path}[${index}]`;
    const to = exception.to ?? exception.from;
    if (!isIsoDate(exception.from) || !isIsoDate(to)) {
      issues.push(error('exception.invalid-date', at));
      return;
    }
    if (to < exception.from) {
      issues.push(error('exception.reversed-range', at));
      return;
    }
    if (daySpan(exception.from, to) > MAX_EXCEPTION_DAYS) {
      issues.push(error('exception.too-long', at));
      return;
    }
    if (!exception.closed) {
      if (!exception.hours.length) issues.push(error('exception.missing-hours', at));
      issues.push(...rangeIssues(exception.hours, `${at}.hours`));
    }
    const dates = eachDate(exception.from, to);
    if (dates.some((date) => claimed.has(date))) issues.push(error('exception.overlap', at));
    for (const date of dates) claimed.add(date);
    if (today && to < today) issues.push(warning('exception.stale', at));
  });
  return issues;
}

function locationIssues(location: StoreLocation, path: string, today?: IsoDate): Issue[] {
  const issues: Issue[] = [];
  const telephone = location.telephone.normalize('NFKC').replace(/\D/g, '');
  if (!/^0\d{9,10}$/.test(telephone))
    issues.push(error('location.invalid-telephone', `${path}.telephone`));
  if (!/^\d{3}-?\d{4}$/.test(location.address.postalCode.normalize('NFKC')))
    issues.push(error('location.invalid-postal-code', `${path}.address.postalCode`));
  for (const key of ['region', 'locality', 'street'] as const)
    if (!location.address[key].trim())
      issues.push(error('location.missing-address', `${path}.address.${key}`));
  for (const day of DAYS)
    issues.push(...rangeIssues(location.hours[day] ?? [], `${path}.hours.${day}`));
  if (DAYS.every((day) => !location.hours[day]?.length))
    issues.push(warning('location.no-regular-hours', `${path}.hours`));
  if (location.url !== undefined && !isHttpsUrl(location.url))
    issues.push(error('location.invalid-url', `${path}.url`));
  location.sameAs?.forEach((url, index) => {
    if (!isHttpsUrl(url)) issues.push(error('location.invalid-same-as', `${path}.sameAs[${index}]`));
  });
  if (location.visit) {
    if (!location.visit.access.trim())
      issues.push(error('visit.missing-access', `${path}.visit.access`));
    if (!isHttpsUrl(location.visit.mapUrl))
      issues.push(error('visit.invalid-map-url', `${path}.visit.mapUrl`));
  }
  issues.push(...exceptionIssues(location.exceptions ?? [], `${path}.exceptions`, today));
  return issues;
}

/** today を渡すと、終わった臨時の案内を警告にする（古い案内を残さない）。 */
export function validateStore(store: StoreProfile, options: { today?: IsoDate } = {}): Issue[] {
  const issues: Issue[] = [];
  if (!(BUSINESS_TYPES as readonly string[]).includes(store.businessType))
    issues.push(error('store.unknown-type', 'businessType'));
  if (!isHttpsUrl(store.url)) issues.push(error('store.invalid-url', 'url'));
  for (const id of duplicates(store.locations.map((location) => location.id)))
    issues.push(error('location.duplicate-id', `locations.${id}`));
  if (store.locations.length > 1)
    for (const name of duplicates(store.locations.map((location) => location.name ?? store.name)))
      issues.push(error('location.duplicate-name', `locations.${name}`));
  for (const location of store.locations)
    issues.push(...locationIssues(location, `locations.${location.id}`, options.today));
  return issues;
}

export const defineStore = (store: StoreProfile): StoreProfile =>
  assertNoErrors(store, validateStore(store), 'store');

function findLocation(store: StoreProfile, locationId?: string): StoreLocation {
  const location =
    locationId === undefined
      ? store.locations[0]
      : store.locations.find((candidate) => candidate.id === locationId);
  if (!location) throw new Error(`Unknown store location: ${locationId}`);
  return location;
}

export interface HoursGroup {
  days: DayOfWeek[];
  ranges: readonly TimeRange[];
}
const rangesKey = (ranges: readonly TimeRange[]) =>
  ranges.map((range) => `${range.opens}-${range.closes}`).join(',');

/** 同じ時間の曜日をまとめる（月曜から順）。区間の無い曜日は定休日。 */
export function groupWeeklyHours(hours: WeeklyHours): { open: HoursGroup[]; closed: DayOfWeek[] } {
  const open: HoursGroup[] = [];
  const closed: DayOfWeek[] = [];
  for (const day of DAYS) {
    const ranges = hours[day] ?? [];
    if (!ranges.length) {
      closed.push(day);
      continue;
    }
    const group = open.find((candidate) => rangesKey(candidate.ranges) === rangesKey(ranges));
    if (group) group.days.push(day);
    else open.push({ days: [day], ranges });
  }
  return { open, closed };
}

/** asOf の日以降に終わる臨時の案内を、始まる日の順に返す。 */
export const upcomingExceptions = (location: StoreLocation, asOf: IsoDate): HoursException[] =>
  (location.exceptions ?? [])
    .filter((exception) => (exception.to ?? exception.from) >= asOf)
    .toSorted((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

type JsonLd = Record<string, unknown>;
const hoursSpec = (fields: JsonLd): JsonLd => ({ '@type': 'OpeningHoursSpecification', ...fields });
const isAreaList = (value: AreaServed | readonly AreaServed[]): value is readonly AreaServed[] =>
  Array.isArray(value);
const areaLd = (area: AreaServed): JsonLd => ({ '@type': area.type, name: area.name });

/**
 * 拠点1つ分の JSON-LD。複数拠点では拠点ごとのページで locationId を渡す。
 * 省略可能な項目は、値があるときだけ出す（紬自身の出力を変えないため）。
 */
export function localBusinessJsonLd(
  store: StoreProfile,
  options: { locationId?: string; asOf?: IsoDate } = {},
): JsonLd {
  const location = findLocation(store, options.locationId);
  const data: JsonLd = {
    '@context': 'https://schema.org',
    '@type': store.businessType,
    name: location.name ?? store.name,
    description: store.description,
    url: location.url ?? store.url,
    telephone: location.telephone,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'JP',
      addressRegion: location.address.region,
      addressLocality: location.address.locality,
      streetAddress: location.address.street,
      postalCode: location.address.postalCode,
    },
  };
  if (location.visit) data.hasMap = location.visit.mapUrl;
  if (store.areaServed)
    data.areaServed = isAreaList(store.areaServed)
      ? store.areaServed.map(areaLd)
      : areaLd(store.areaServed);
  const weekly = groupWeeklyHours(location.hours).open.flatMap((group) =>
    group.ranges.map((range) =>
      hoursSpec({ dayOfWeek: group.days, opens: range.opens, closes: range.closes }),
    ),
  );
  if (weekly.length) data.openingHoursSpecification = weekly;
  const exceptions = options.asOf
    ? upcomingExceptions(location, options.asOf)
    : (location.exceptions ?? []);
  const special = exceptions.flatMap((exception) => {
    const valid = { validFrom: exception.from, validThrough: exception.to ?? exception.from };
    // 終日休業は opens と closes を 00:00 にそろえて表す。
    return exception.closed
      ? [hoursSpec({ opens: '00:00', closes: '00:00', ...valid })]
      : exception.hours.map((range) =>
          hoursSpec({ opens: range.opens, closes: range.closes, ...valid }),
        );
  });
  if (special.length) data.specialOpeningHoursSpecification = special;
  if (location.sameAs?.length) data.sameAs = [...location.sameAs];
  if (store.locations.length > 1)
    data.parentOrganization = { '@type': 'Organization', name: store.name, url: store.url };
  data.knowsLanguage = store.language;
  return data;
}

/**
 * Google ビジネスプロフィールなど外部の掲載情報を、担当者が書き写したもの。
 * API から取得しない（外部送信・契約を伴わない）。書き写した日を capturedOn に残す。
 */
export interface ListingSnapshot {
  source: string;
  capturedOn: IsoDate;
  name: string;
  telephone: string;
  address: PostalAddress;
  hours: WeeklyHours;
  exceptions?: readonly HoursException[];
  website?: string;
  mapUrl?: string;
  /** 掲載ページ自体の URL。サイト側の sameAs に含まれているかを確かめる */
  profileUrl?: string;
}

export interface ListingMismatch {
  field: string;
  site: string;
  listing: string;
}

const HYPHENS = /[‐‑‒–—―−－]/g;
const text = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').replace(HYPHENS, '-');
const street = (value: string) =>
  text(value)
    .replace(/(\d)ー(?=\d)/g, '$1-')
    .replace(/(\d+)丁目/g, '$1-')
    .replace(/(\d+)番地?/g, '$1-')
    .replace(/(\d+)号/g, '$1')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
const digits = (value: string) => {
  const raw = value.normalize('NFKC').replace(/[^\d+]/g, '');
  return raw.startsWith('+81') ? `0${raw.slice(3)}` : raw.replace(/\+/g, '');
};
const link = (value: string) => {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch {
    return value.trim();
  }
};
const same = (value: string) => value;
const dayHours = (ranges: readonly TimeRange[] | undefined) =>
  ranges?.length ? rangesKey(ranges) : 'closed';

function exceptionDays(exceptions: readonly HoursException[] | undefined, from: IsoDate) {
  const days = new Map<IsoDate, string>();
  for (const exception of exceptions ?? [])
    for (const date of eachDate(exception.from, exception.to ?? exception.from))
      if (date >= from) days.set(date, exception.closed ? 'closed' : rangesKey(exception.hours));
  return days;
}

/**
 * サイトの正本と外部の掲載情報の違いを返す。表記ゆれ（全角・空白・丁目番地・国番号）は同じとみなす。
 * 臨時の案内は、書き写した日以降の日付だけを比べる。
 */
export function reconcileListing(
  store: StoreProfile,
  snapshot: ListingSnapshot,
  locationId?: string,
): ListingMismatch[] {
  const location = findLocation(store, locationId);
  const mismatches: ListingMismatch[] = [];
  const compare = (
    field: string,
    site: string,
    listing: string,
    normalize: (value: string) => string,
  ) => {
    if (normalize(site) !== normalize(listing)) mismatches.push({ field, site, listing });
  };
  compare('name', location.name ?? store.name, snapshot.name, text);
  compare('telephone', location.telephone, snapshot.telephone, digits);
  compare('address.postalCode', location.address.postalCode, snapshot.address.postalCode, digits);
  compare('address.region', location.address.region, snapshot.address.region, text);
  compare('address.locality', location.address.locality, snapshot.address.locality, text);
  compare('address.street', location.address.street, snapshot.address.street, street);
  for (const day of DAYS)
    compare(`hours.${day}`, dayHours(location.hours[day]), dayHours(snapshot.hours[day]), same);
  const siteDays = exceptionDays(location.exceptions, snapshot.capturedOn);
  const listingDays = exceptionDays(snapshot.exceptions, snapshot.capturedOn);
  for (const date of [...new Set([...siteDays.keys(), ...listingDays.keys()])].sort())
    compare(
      `exceptions.${date}`,
      siteDays.get(date) ?? 'regular',
      listingDays.get(date) ?? 'regular',
      same,
    );
  if (snapshot.website !== undefined)
    compare('website', location.url ?? store.url, snapshot.website, link);
  if (snapshot.mapUrl !== undefined)
    compare('mapUrl', location.visit?.mapUrl ?? '', snapshot.mapUrl, link);
  if (snapshot.profileUrl !== undefined) {
    const profile = link(snapshot.profileUrl);
    const linked = (location.sameAs ?? []).find((url) => link(url) === profile);
    if (!linked) mismatches.push({ field: 'sameAs', site: '', listing: snapshot.profileUrl });
  }
  return mismatches;
}
