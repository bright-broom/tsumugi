import type { ReportLevel } from '@/lib/verification-report';

/** N/A は「対象がなかった」（例：画像 0 枚のページの alt 検査）。PASS には数えない */
export type Level = ReportLevel;
export interface Result { level: Level; check: string; page: string; detail: string }

/** 検査結果。記録した順に並ぶ（レポートの JSON もこの順） */
export const R: Result[] = [];

export function rec(level: Level, check: string, page: string, detail = ''): void {
  R.push({ level, check, page, detail });
}
