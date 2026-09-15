/** 日付は日本時間の暦日（YYYY-MM-DD）、月は YYYY-MM で扱う。 */
import { z } from 'zod';
import { OpsError } from './store';

const isRealDate = (value: string) => {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付は YYYY-MM-DD')
  .refine(isRealDate, '存在しない日付です');
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月は YYYY-MM');
/** 時刻はタイムゾーン付きの ISO 8601。 */
export const timestampSchema = z.iso.datetime({ offset: true });

export function parseDate(value: string, name: string): string {
  if (!dateSchema.safeParse(value).success) throw new OpsError(`${name}: 日付は YYYY-MM-DD`);
  return value;
}

export function parseMonth(value: string, name: string): string {
  if (!monthSchema.safeParse(value).success) throw new OpsError(`${name}: 月は YYYY-MM`);
  return value;
}

const JST = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });

/** 日付か、タイムゾーン付きの時刻を、日本時間の暦日にする。 */
export function jstDate(value: string): string {
  if (dateSchema.safeParse(value).success) return value;
  if (!timestampSchema.safeParse(value).success)
    throw new OpsError(`日時を読めません（YYYY-MM-DD かタイムゾーン付きの ISO 8601）: ${value}`);
  return JST.format(new Date(value));
}

export const today = () => JST.format(new Date());
export const now = () => new Date().toISOString();

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: addDays(`${shiftMonth(month, 1)}-01`, -1) };
}

/** from〜to（両端を含む）の暦日。 */
export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return dates;
}
