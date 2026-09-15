/**
 * 修正依頼の受付・状態・担当と期限・作業時間（Issue #26、ADR 0038）。
 * 顧客ごとのアクセス権限は未実装。ファイルを顧客ごとに分け、読み込み時に顧客 ID を照合する。
 * 完了連絡は「連絡した」という記録だけを持ち、ツールからは送信しない。
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { RUN } from '@/content/prices';
import { OpsError, assertCustomer, idSchema, readJson } from '../shared/store';
import { dateSchema, jstDate, monthRange, shiftMonth, timestampSchema } from '../shared/time';

const STATUSES = ['received', 'in_progress', 'awaiting_review', 'done'] as const;
export type Status = (typeof STATUSES)[number];
const statusSchema = z.enum(STATUSES);
export const STATUS_LABELS: Record<Status, string> = {
  received: '受付',
  in_progress: '着手',
  awaiting_review: '確認待ち',
  done: '完了',
};
/** 確認待ちからは差し戻し（着手）か完了だけ。完了からは動かさない（新しい依頼として受け付ける）。 */
const NEXT: Record<Status, readonly Status[]> = {
  received: ['in_progress'],
  in_progress: ['awaiting_review'],
  awaiting_review: ['in_progress', 'done'],
  done: [],
};

const text = z.string().trim().min(1);

const locationSchema = z
  .strictObject({
    selector: text.optional(),
    x: z.int().min(0).optional(),
    y: z.int().min(0).optional(),
    viewportWidth: z.int().min(1).optional(),
    note: text.optional(),
  })
  .refine(
    (l) =>
      l.selector !== undefined || l.note !== undefined || (l.x !== undefined && l.y !== undefined),
    '画面上の位置は selector・座標（x と y）・説明のどれかで指定してください',
  );
export type ScreenLocation = z.infer<typeof locationSchema>;

const requestSchema = z.strictObject({
  id: idSchema,
  customerId: idSchema,
  receivedAt: timestampSchema,
  channel: text,
  url: z.url({ protocol: /^https?$/, error: 'URL は http(s) だけ' }),
  location: locationSchema,
  description: text,
  /** 添付はファイル本体を持たず、保管場所の参照だけを記録する。 */
  attachments: z.array(z.strictObject({ ref: text, note: text.optional() })),
  status: statusSchema,
  assignee: text.optional(),
  dueOn: dateSchema.optional(),
  history: z
    .array(
      z.strictObject({
        at: timestampSchema,
        by: text,
        from: statusSchema.nullable(),
        to: statusSchema,
        note: text.optional(),
      }),
    )
    .min(1),
  work: z.array(
    z.strictObject({
      date: dateSchema,
      minutes: z.int().min(1).max(1440),
      by: text,
      note: text.optional(),
    }),
  ),
  completionNotice: z
    .strictObject({ recordedAt: timestampSchema, by: text, channel: text, note: text.optional() })
    .optional(),
});
type WorkRequest = z.infer<typeof requestSchema>;

export const requestsFileSchema = z
  .strictObject({
    customerId: idSchema,
    /** 記録を始めた日。これより前の月は「未記録」で、0 分とは扱わない。 */
    trackingSince: dateSchema,
    requests: z.array(requestSchema),
  })
  .superRefine((file, ctx) => {
    const ids = new Set<string>();
    file.requests.forEach((r, i) => {
      if (ids.has(r.id))
        ctx.addIssue({
          code: 'custom',
          path: ['requests', i, 'id'],
          message: `依頼 ID が重複: ${r.id}`,
        });
      ids.add(r.id);
      if (r.customerId !== file.customerId)
        ctx.addIssue({
          code: 'custom',
          path: ['requests', i, 'customerId'],
          message: '他の顧客の依頼が混ざっています',
        });
      if (r.history.at(-1)?.to !== r.status)
        ctx.addIssue({
          code: 'custom',
          path: ['requests', i, 'status'],
          message: '状態と履歴が一致しません',
        });
    });
  });
export type RequestsFile = z.infer<typeof requestsFileSchema>;

const validate = (file: unknown): RequestsFile => {
  const parsed = requestsFileSchema.safeParse(file);
  if (!parsed.success)
    throw new OpsError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  return parsed.data;
};
const find = (file: RequestsFile, id: string) => {
  const found = file.requests.find((r) => r.id === id);
  if (!found) throw new OpsError(`依頼がありません: ${id}`);
  return found;
};
const replace = (file: RequestsFile, updated: WorkRequest) =>
  validate({ ...file, requests: file.requests.map((r) => (r.id === updated.id ? updated : r)) });

export function addRequest(
  file: RequestsFile,
  input: {
    receivedAt: string;
    channel: string;
    url: string;
    location: ScreenLocation;
    description: string;
    attachments?: { ref: string; note?: string }[];
    assignee?: string;
    dueOn?: string;
    by: string;
  },
): { file: RequestsFile; id: string } {
  if (jstDate(input.receivedAt) < file.trackingSince)
    throw new OpsError(`受付日が記録開始日（${file.trackingSince}）より前です`);
  const id = `req-${String(file.requests.length + 1).padStart(4, '0')}`;
  const request = {
    id,
    customerId: file.customerId,
    receivedAt: input.receivedAt,
    channel: input.channel,
    url: input.url,
    location: input.location,
    description: input.description,
    attachments: input.attachments ?? [],
    status: 'received',
    ...(input.assignee ? { assignee: input.assignee } : {}),
    ...(input.dueOn ? { dueOn: input.dueOn } : {}),
    history: [{ at: input.receivedAt, by: input.by, from: null, to: 'received' }],
    work: [],
  };
  return { file: validate({ ...file, requests: [...file.requests, request] }), id };
}

export function moveRequest(
  file: RequestsFile,
  id: string,
  to: string,
  meta: { at: string; by: string; note?: string },
): RequestsFile {
  const r = find(file, id);
  const target = statusSchema.safeParse(to);
  if (!target.success) throw new OpsError(`状態は ${STATUSES.join('・')} のどれか`);
  if (!NEXT[r.status].includes(target.data))
    throw new OpsError(
      `「${STATUS_LABELS[r.status]}」から「${STATUS_LABELS[target.data]}」には進められません`,
    );
  return replace(file, {
    ...r,
    status: target.data,
    history: [
      ...r.history,
      {
        at: meta.at,
        by: meta.by,
        from: r.status,
        to: target.data,
        ...(meta.note ? { note: meta.note } : {}),
      },
    ],
  });
}

export function assignRequest(
  file: RequestsFile,
  id: string,
  change: { assignee?: string; dueOn?: string },
): RequestsFile {
  const r = find(file, id);
  if (r.status === 'done') throw new OpsError('完了した依頼の担当・期限は変えません');
  return replace(file, { ...r, ...change });
}

export function logWork(
  file: RequestsFile,
  id: string,
  entry: { date: string; minutes: number; by: string; note?: string },
): RequestsFile {
  const r = find(file, id);
  if (r.status === 'received') throw new OpsError('着手してから作業時間を記録してください');
  if (entry.date < jstDate(r.receivedAt)) throw new OpsError('受付より前の日付には記録できません');
  return replace(file, { ...r, work: [...r.work, entry] });
}

export function recordCompletionNotice(
  file: RequestsFile,
  id: string,
  notice: { recordedAt: string; by: string; channel: string; note?: string },
): RequestsFile {
  const r = find(file, id);
  if (r.status !== 'done') throw new OpsError('完了してから完了連絡を記録してください');
  if (r.completionNotice) throw new OpsError('完了連絡は記録済みです');
  return replace(file, { ...r, completionNotice: notice });
}

export interface MonthlyWork {
  month: string;
  /** false：記録開始より前の月（未記録）。partial：記録開始が月の途中。 */
  tracked: boolean;
  partial: boolean;
  rawMinutes: number;
  /** 月の合計を 5 分単位で切り上げる。依頼ごとには切り上げない（料金表の変更枠の説明どおり）。 */
  billedMinutes: number;
  byRequest: { id: string; description: string; status: Status; minutes: number }[];
}

export function monthlyWork(file: RequestsFile, month: string): MonthlyWork {
  const { from, to } = monthRange(month);
  const byRequest = file.requests
    .map((r) => ({
      id: r.id,
      description: r.description,
      status: r.status,
      minutes: r.work
        .filter((w) => from <= w.date && w.date <= to)
        .reduce((a, w) => a + w.minutes, 0),
    }))
    .filter((r) => r.minutes > 0);
  const rawMinutes = byRequest.reduce((a, r) => a + r.minutes, 0);
  return {
    month,
    tracked: to >= file.trackingSince,
    partial: from < file.trackingSince && file.trackingSince <= to,
    rawMinutes,
    billedMinutes: Math.ceil(rawMinutes / 5) * 5,
    byRequest,
  };
}

/** 直近 3 か月（対象月を含む）の平均。3 か月とも月初から記録していなければ出さない。 */
export function threeMonthAverage(file: RequestsFile, month: string) {
  const months = [-2, -1, 0].map((d) => monthlyWork(file, shiftMonth(month, d)));
  const complete = months.every((m) => m.tracked && !m.partial);
  return {
    months,
    averageMinutes: complete ? months.reduce((a, m) => a + m.billedMinutes, 0) / 3 : null,
  };
}

export function allowanceFor(planKey: string): { name: string; minutes: number } {
  const plan = RUN.find((p) => p.key === planKey);
  if (!plan) throw new OpsError(`継続支援のプランがありません: ${planKey}`);
  return { name: plan.name, minutes: plan.minutes };
}

export function openRequests(file: RequestsFile, today: string) {
  return file.requests
    .filter((r) => r.status !== 'done')
    .map((r) => ({ request: r, overdue: r.dueOn !== undefined && r.dueOn < today }));
}

export const requestsPath = (dataDir: string, customerId: string) =>
  join(dataDir, 'requests', `${customerId}.json`);

export function loadRequests(dataDir: string, customerId: string): RequestsFile | null {
  const path = requestsPath(dataDir, customerId);
  if (!existsSync(path)) return null;
  const file = readJson(path, requestsFileSchema);
  assertCustomer(path, customerId, file.customerId);
  return file;
}
