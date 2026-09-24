/**
 * 日付で変わる案内を、静的なサイトへ反映するための判定（監査 C08）。
 *
 * 臨時休業・臨時の営業時間は、ビルドした日（content/store.ts の STORE_AS_OF）を基準に、
 * 終わったものを表示と JSON-LD から外している。静的サイトは置いたままでは変わらないので、
 * 「日付をまたいで表示が変わるはずの日」に作り直す必要がある。その日かどうかだけをここで決める。
 *
 * 通信も再配備もしない。実際の作り直しはワークフローが配備フックを叩いて行う。
 */
import { isIsoDate, type IsoDate } from '@/lib/storefront/core';
import type { StoreProfile, HoursException } from '@/lib/storefront/store';
import { upcomingExceptions } from '@/lib/storefront/store';

export interface Boundary {
  locationId: string;
  /** その日に表示が変わる臨時の案内 */
  exception: HoursException;
  reason: 'starts' | 'ended';
}

const key = (location: string, exception: HoursException) =>
  `${location}:${exception.from}:${exception.to ?? exception.from}`;

/**
 * `since`（前回の作り直し。通常は前日）から `today` までに、表示が変わる境目があったか。
 *
 * - 始まる日：`from` が since より後で today 以前
 * - 終わった日：`to`（省略時は from）が since 以降で today より前 ＝ 表示から外れる
 */
export function boundaries(store: StoreProfile, since: string, today: string): Boundary[] {
  if (!isIsoDate(since) || !isIsoDate(today))
    throw new Error(`日付は YYYY-MM-DD（実在する日）で指定してください: ${since}・${today}`);
  if (since > today) throw new Error(`since は today 以前にしてください: ${since} > ${today}`);
  const found: Boundary[] = [];
  for (const location of store.locations) {
    const before = new Set(
      upcomingExceptions(location, since as IsoDate).map((e) => key(location.id, e)),
    );
    const now = new Set(
      upcomingExceptions(location, today as IsoDate).map((e) => key(location.id, e)),
    );
    for (const exception of location.exceptions ?? []) {
      const id = key(location.id, exception);
      // 表示から外れた（終わった）
      if (before.has(id) && !now.has(id))
        found.push({ locationId: location.id, exception, reason: 'ended' });
      // 今日から始まる（案内の中身が「予定」から「今日」に変わる）
      else if (exception.from > since && exception.from <= today)
        found.push({ locationId: location.id, exception, reason: 'starts' });
    }
  }
  return found;
}

export const describeBoundary = (boundary: Boundary): string => {
  const { exception } = boundary;
  const period =
    exception.to && exception.to !== exception.from
      ? `${exception.from}〜${exception.to}`
      : exception.from;
  const what = exception.closed ? '臨時休業' : '臨時の営業時間';
  const note = exception.note ? `（${exception.note}）` : '';
  return `${boundary.locationId}: ${what} ${period}${note} が${
    boundary.reason === 'ended' ? '終わり、表示から外れます' : '始まります'
  }`;
};

/** 境目の有無から、作り直しの要否・終了コード・伝える一行を決める。 */
export function refreshDecision(
  found: readonly Boundary[],
  period: { since: string; today: string },
): { refresh: boolean; code: 0 | 10; message: string } {
  const { since, today } = period;
  return found.length
    ? {
        refresh: true,
        code: 10,
        message: `${since} から ${today} までに表示が変わります。サイトを作り直してください（${found.length} 件）`,
      }
    : {
        refresh: false,
        code: 0,
        message: `${since} から ${today} までに、日付で変わる表示はありません`,
      };
}
