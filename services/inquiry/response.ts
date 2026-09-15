/**
 * 初回返信の記録と、返信期限に対する実績（ADR 0033）。
 * 実績は記録から計算するだけで、サイトの RESPONSE_ACTUAL には書き込まない。
 * 掲載はオーナーが実データを確認してから行う。
 */
import type { BusinessCalendar } from './calendar';
import type { InquiryRecord, ReplyChannel } from './records';

/** 初回返信を記録する。すでに記録があれば変更しない（最初の返信だけが実績になる） */
export function withFirstReply(
  record: InquiryRecord,
  at: Date,
  channel: ReplyChannel,
): InquiryRecord | undefined {
  if (record.response.firstReplyAt) return undefined;
  if (at.getTime() < Date.parse(record.receivedAt))
    throw new Error('First reply cannot precede the inquiry');
  const iso = at.toISOString();
  return {
    ...record,
    response: { ...record.response, firstReplyAt: iso, firstReplyChannel: channel },
    lastActivityAt: iso > record.lastActivityAt ? iso : record.lastActivityAt,
  };
}

export type ResponseState = 'met' | 'late' | 'pending' | 'overdue' | 'untracked';

export function responseState(record: InquiryRecord, now: Date): ResponseState {
  const { deadline, firstReplyAt } = record.response;
  if (!deadline) return 'untracked';
  if (firstReplyAt) return firstReplyAt <= deadline ? 'met' : 'late';
  return now.toISOString() > deadline ? 'overdue' : 'pending';
}

export interface ResponseSummary {
  total: number;
  met: number;
  late: number;
  pending: number;
  overdue: number;
  untracked: number;
  /** 返信済みのうち期限内の割合。返信済みが 0 件なら null（実績なし） */
  metRate: number | null;
  /** 受付から初回返信までの営業時間（分）の最大値。返信済みが 0 件なら null */
  maxBusinessMinutes: number | null;
}

/** 迷惑投稿の疑いは数えない */
export function summarizeResponses(
  records: readonly InquiryRecord[],
  calendar: BusinessCalendar,
  now: Date,
): ResponseSummary {
  const counted = records.filter((r) => r.disposition === 'accepted');
  const summary: ResponseSummary = {
    total: counted.length,
    met: 0,
    late: 0,
    pending: 0,
    overdue: 0,
    untracked: 0,
    metRate: null,
    maxBusinessMinutes: null,
  };
  for (const record of counted) {
    summary[responseState(record, now)] += 1;
    if (record.response.firstReplyAt) {
      const minutes = calendar.businessMinutesBetween(
        new Date(record.receivedAt),
        new Date(record.response.firstReplyAt),
      );
      summary.maxBusinessMinutes = Math.max(summary.maxBusinessMinutes ?? 0, minutes);
    }
  }
  const replied = summary.met + summary.late;
  if (replied) summary.metRate = summary.met / replied;
  return summary;
}
