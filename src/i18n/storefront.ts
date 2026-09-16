/**
 * 顧客テンプレートの値（営業時間・日付・依頼表示）をカタログの文言で組み立てる。
 * 画面の表示と検査（テスト）が同じ関数を使い、表記を2か所で持たない。
 */
import type { Messages } from '@/i18n/catalog';
import { format } from '@/i18n/format';
import { dateParts, type IsoDate } from '@/lib/storefront/core';
import {
  DAYS,
  groupWeeklyHours,
  type DayOfWeek,
  type HoursException,
  type PostalAddress,
  type TimeRange,
  type WeeklyHours,
} from '@/lib/storefront/store';
import type { PublishedTestimonial } from '@/lib/storefront/testimonials';

type StoreCopy = Messages['storefront']['store'];
type VoiceCopy = Messages['storefront']['testimonials'];

const WEEKDAYS = DAYS.slice(0, 5).join();
const clock = (time: string) => time.replace(/^0(\d):/, '$1:');

export const formatAddress = (address: PostalAddress, copy: StoreCopy) =>
  format(copy.addressValue, {
    postalCode: address.postalCode,
    region: address.region,
    locality: address.locality,
    street: address.street,
  });

const formatRanges = (ranges: readonly TimeRange[], copy: StoreCopy) =>
  ranges
    .map((range) =>
      format(copy.timeRange, { opens: clock(range.opens), closes: clock(range.closes) }),
    )
    .join(copy.listJoin);

function formatDays(days: readonly DayOfWeek[], copy: StoreCopy): string {
  if (days.length === DAYS.length) return copy.everyday;
  if (days.join() === WEEKDAYS) return copy.weekdays;
  const indexes = days.map((day) => DAYS.indexOf(day));
  const consecutive = indexes.every((value, i) => i === 0 || value === indexes[i - 1]! + 1);
  if (days.length >= 3 && consecutive)
    return format(copy.dayRange, { from: copy.days[days[0]!], to: copy.days[days.at(-1)!] });
  return days.map((day) => copy.days[day]).join(copy.dayJoin);
}

/** 1行ずつ「平日 9:00〜18:00」の形で返す。 */
export const formatWeeklyHours = (hours: WeeklyHours, copy: StoreCopy): string[] =>
  groupWeeklyHours(hours).open.map((group) =>
    format(copy.hoursLine, {
      days: formatDays(group.days, copy),
      hours: formatRanges(group.ranges, copy),
    }),
  );

export function formatClosedDays(
  hours: WeeklyHours,
  publicHolidays: 'open' | 'closed' | undefined,
  copy: StoreCopy,
): string {
  const labels = groupWeeklyHours(hours).closed.map((day) => copy.days[day] as string);
  if (publicHolidays === 'closed') labels.push(copy.publicHolidays);
  return labels.length ? labels.join(copy.dayJoin) : copy.noClosedDays;
}

function formatDate(value: IsoDate, copy: StoreCopy): string {
  const { year, month, day } = dateParts(value);
  return format(copy.date, { year, month, day });
}

export function formatException(exception: HoursException, copy: StoreCopy): string {
  const to = exception.to ?? exception.from;
  const dates =
    to === exception.from
      ? formatDate(exception.from, copy)
      : format(copy.dateRange, {
          from: formatDate(exception.from, copy),
          to: formatDate(to, copy),
        });
  const status = exception.closed
    ? copy.closed
    : format(copy.specialHours, { hours: formatRanges(exception.hours, copy) });
  const line = format(copy.exceptionLine, { dates, status });
  return exception.note ? format(copy.withNote, { text: line, note: exception.note }) : line;
}

export function formatParking(parking: { available: boolean; note?: string }, copy: StoreCopy) {
  const status = parking.available ? copy.parkingAvailable : copy.parkingUnavailable;
  return parking.note ? format(copy.withNote, { text: status, note: parking.note }) : status;
}

/** 依頼・謝礼がある声に添える説明。表示が不要な声は null。 */
export function formatDisclosure(
  testimonial: PublishedTestimonial,
  copy: VoiceCopy,
  business: string,
): string | null {
  const incentive = copy.incentives[testimonial.incentive ?? 'other'];
  switch (testimonial.disclosure) {
    case null:
      return null;
    case 'requested':
      return format(copy.requested, { business });
    case 'incentive':
      return format(copy.incentive, { incentive });
    case 'requestedWithIncentive':
      return format(copy.requestedWithIncentive, { business, incentive });
  }
}

export function formatSource(source: PublishedTestimonial['source'], copy: VoiceCopy): string {
  const { year, month } = dateParts(source.collectedOn);
  return format(copy.source, {
    kind: copy.sourceKinds[source.kind],
    date: format(copy.month, { year, month }),
  });
}
