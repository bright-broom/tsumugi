/**
 * 営業日カレンダーと返信期限（ADR 0033）。
 *
 * 「1 営業日以内」は、受付の直後の営業時間から、営業時間 1 日分（開店〜閉店の長さ）を進めた時刻とする。
 * 例: 平日 9:00〜18:00 の場合、火曜 10:00 の受付 → 水曜 10:00、火曜 20:00 の受付 → 水曜 18:00、
 * 土曜の受付 → 月曜 18:00（月曜が営業日のとき）。
 */

export interface BusinessCalendarConfig {
  utcOffsetMinutes: number;
  opensAtMinutes: number;
  closesAtMinutes: number;
  closedWeekdays: readonly number[];
  holidays: readonly string[];
  closures: readonly string[];
  coverage: { from: string; to: string };
}

export class CalendarCoverageError extends Error {
  constructor(day: string) {
    super(`Business calendar does not cover ${day}; add holidays for that year`);
    this.name = 'CalendarCoverageError';
  }
}

const DAY = 86_400_000;
const MINUTE = 60_000;
const dayKey = (localMs: number) => new Date(localMs).toISOString().slice(0, 10);
const startOfDay = (localMs: number) => Math.floor(localMs / DAY) * DAY;

export interface BusinessCalendar {
  readonly config: BusinessCalendarConfig;
  isBusinessDay(day: string): boolean;
  /** 営業時間だけを数えて minutes 分進めた時刻 */
  addBusinessMinutes(from: Date, minutes: number): Date;
  /** from から to までに含まれる営業時間（分） */
  businessMinutesBetween(from: Date, to: Date): number;
  replyDeadline(receivedAt: Date): Date;
  /** 日本時間などカレンダーの地域時刻での年月日・時分 */
  localParts(at: Date): { year: number; month: number; day: number; hour: number; minute: number };
}

export function createBusinessCalendar(config: BusinessCalendarConfig): BusinessCalendar {
  const { utcOffsetMinutes, opensAtMinutes, closesAtMinutes } = config;
  if (!(opensAtMinutes >= 0 && opensAtMinutes < closesAtMinutes && closesAtMinutes <= 24 * 60))
    throw new Error('Business hours must open before they close within one day');
  const holidays = new Set([...config.holidays, ...config.closures]);
  const offset = utcOffsetMinutes * MINUTE;
  const businessDayMinutes = closesAtMinutes - opensAtMinutes;

  function isBusinessDay(day: string): boolean {
    if (day < config.coverage.from || day > config.coverage.to) throw new CalendarCoverageError(day);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    return !config.closedWeekdays.includes(weekday) && !holidays.has(day);
  }

  function addBusinessMinutes(from: Date, minutes: number): Date {
    if (minutes < 0) throw new Error('Business minutes must not be negative');
    let local = from.getTime() + offset;
    let remaining = minutes * MINUTE;
    // 1 年分の休業が続くことはないので、上限を超えたら設定の誤りとして止める
    for (let guard = 0; guard < 400; guard += 1) {
      const dayStart = startOfDay(local);
      if (isBusinessDay(dayKey(dayStart))) {
        const open = dayStart + opensAtMinutes * MINUTE;
        const close = dayStart + closesAtMinutes * MINUTE;
        if (local < open) local = open;
        if (local < close) {
          const available = close - local;
          if (remaining <= available) return new Date(local + remaining - offset);
          remaining -= available;
        }
      }
      local = dayStart + DAY;
    }
    throw new Error('No business hours found within 400 days');
  }

  function businessMinutesBetween(from: Date, to: Date): number {
    let local = from.getTime() + offset;
    const end = to.getTime() + offset;
    let total = 0;
    while (local < end) {
      const dayStart = startOfDay(local);
      if (isBusinessDay(dayKey(dayStart))) {
        const open = Math.max(local, dayStart + opensAtMinutes * MINUTE);
        const close = Math.min(end, dayStart + closesAtMinutes * MINUTE);
        if (close > open) total += close - open;
      }
      local = dayStart + DAY;
    }
    return Math.round(total / MINUTE);
  }

  return {
    config,
    isBusinessDay,
    addBusinessMinutes,
    businessMinutesBetween,
    replyDeadline: (receivedAt) => addBusinessMinutes(receivedAt, businessDayMinutes),
    localParts(at) {
      const local = new Date(at.getTime() + offset);
      return {
        year: local.getUTCFullYear(),
        month: local.getUTCMonth() + 1,
        day: local.getUTCDate(),
        hour: local.getUTCHours(),
        minute: local.getUTCMinutes(),
      };
    },
  };
}
