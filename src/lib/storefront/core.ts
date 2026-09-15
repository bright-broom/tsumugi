/**
 * 顧客テンプレートのデータ（店舗・連絡導線・スタッフ・お客様の声）が共有する小道具。
 * 文言を持たない。問題は機械的なコードで返し、表示や報告の言葉は呼び出し側が決める。
 */

/** 設定ファイルに書く日付。`YYYY-MM-DD` で、事業者の所在地の暦として扱う。 */
export type IsoDate = `${number}-${number}-${number}`;

export type Severity = 'error' | 'warning';
export interface Issue {
  severity: Severity;
  code: string;
  path: string;
}

/** テンプレートを使う業種の分類。業種別ページ（routing）とは独立に持つ。 */
export type Industry = 'restaurant' | 'construction' | 'salon' | 'professional';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function utc(value: string): number | undefined {
  const match = ISO_DATE.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? time
    : undefined;
}

/** 実在する日付だけを受け付ける（2026-02-30 は不可）。 */
export const isIsoDate = (value: string): value is IsoDate => utc(value) !== undefined;

export function dateParts(value: IsoDate): { year: number; month: number; day: number } {
  const time = utc(value);
  if (time === undefined) throw new Error(`Invalid date: ${value}`);
  const date = new Date(time);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** 両端を含む日数。検査済みの日付だけを渡す。 */
export function daySpan(from: IsoDate, to: IsoDate): number {
  return Math.round((utc(to)! - utc(from)!) / DAY_MS) + 1;
}

/** from から to までの日付（両端を含む）。 */
export function eachDate(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let time = utc(from)!; time <= utc(to)!; time += DAY_MS)
    dates.push(new Date(time).toISOString().slice(0, 10) as IsoDate);
  return dates;
}

/** ビルドするマシンの時間帯に依らず、事業者の時間帯での日付を返す。 */
export function dateInZone(instant: Date, timeZone: string): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant) as IsoDate;
}

/** 公開ページから外部へ出すリンクは https だけ。認証情報入りの URL は拒否する。 */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.')
    );
  } catch {
    return false;
  }
}

export function duplicates<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated];
}

/** 掲載許可・同意の記録が、その日付の時点で有効か。 */
export interface ConsentRecord {
  /** 本人に確認した日 */
  grantedOn: IsoDate;
  /** 同意書・メールなど、確認の記録の置き場所を示す識別子（個人情報は書かない） */
  recordRef: string;
  /** 撤回された日。設定すると以後は掲載しない */
  withdrawnOn?: IsoDate;
}

export const consentActive = (consent: ConsentRecord | null | undefined): boolean =>
  Boolean(consent && consent.recordRef.trim() && !consent.withdrawnOn);

export function consentIssues(consent: ConsentRecord, path: string): Issue[] {
  const issues: Issue[] = [];
  if (!isIsoDate(consent.grantedOn)) issues.push(error('consent.invalid-date', `${path}.grantedOn`));
  if (!consent.recordRef.trim()) issues.push(error('consent.missing-record', `${path}.recordRef`));
  if (consent.withdrawnOn !== undefined) {
    if (!isIsoDate(consent.withdrawnOn))
      issues.push(error('consent.invalid-date', `${path}.withdrawnOn`));
    else if (isIsoDate(consent.grantedOn) && consent.withdrawnOn < consent.grantedOn)
      issues.push(error('consent.withdrawn-before-granted', `${path}.withdrawnOn`));
  }
  return issues;
}

export const error = (code: string, path: string): Issue => ({ severity: 'error', code, path });
export const warning = (code: string, path: string): Issue => ({
  severity: 'warning',
  code,
  path,
});

/** 設定ファイルが読み込まれた時点で誤りを止める。警告は検査（テスト）で扱う。 */
export function assertNoErrors<T>(value: T, issues: readonly Issue[], name: string): T {
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length)
    throw new Error(`${name}: ${errors.map((issue) => `${issue.path} ${issue.code}`).join(', ')}`);
  return value;
}

/** 画像は寸法を必ず持つ（レイアウトのずれを防ぐ）。代替テキストは空にしない。 */
export interface Photo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export function photoIssues(photo: Photo, path: string): Issue[] {
  const issues: Issue[] = [];
  const alt = photo.alt.trim();
  const file = photo.src.split('/').pop() ?? '';
  if (!alt || alt === file) issues.push(error('photo.missing-alt', `${path}.alt`));
  if (!(Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0))
    issues.push(error('photo.invalid-size', path));
  if (!photo.src.startsWith('/') && !isHttpsUrl(photo.src))
    issues.push(error('photo.invalid-src', `${path}.src`));
  return issues;
}
