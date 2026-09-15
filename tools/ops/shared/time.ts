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
/** 時刻はタイムゾーン付きの ISO 8601。 */
export const timestampSchema = z.iso.datetime({ offset: true });

export function parseDate(value: string, name: string): string {
  if (!dateSchema.safeParse(value).success) throw new OpsError(`${name}: 日付は YYYY-MM-DD`);
  return value;
}

const JST = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });

export const today = () => JST.format(new Date());
export const now = () => new Date().toISOString();
