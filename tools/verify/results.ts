export type Level = 'PASS' | 'WARN' | 'FAIL';
export interface Result { level: Level; check: string; page: string; detail: string }

/** 検査結果。記録した順に並ぶ（レポートの JSON もこの順） */
export const R: Result[] = [];

export function rec(level: Level, check: string, page: string, detail = ''): void {
  R.push({ level, check, page, detail });
}
