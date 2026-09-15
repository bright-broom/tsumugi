/**
 * GBP（Google ビジネスプロフィール）の紐付け・情報の突き合わせ・投稿と口コミ返信の承認記録（Issue #30、ADR 0039）。
 * API は使わない。サイトの設定と、GBP の管理画面から手で書き出した情報を比べる。
 * 投稿・返信はツールから行わない。人が実施したことを、承認済みの文面と一致する場合だけ記録する。
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { sha256 } from '../shared/cli';
import { canonicalUrl, nfkc, normalizePhone } from '../shared/normalize';
import { OpsError, assertCustomer, idSchema, readJson } from '../shared/store';
import { dateSchema, timestampSchema } from '../shared/time';

const text = z.string().trim().min(1);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '時刻は HH:MM');
/** 空の配列は休業日。 */
const rangesSchema = z.array(z.strictObject({ open: time, close: time }));
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
} as const;

export const profileSchema = z.strictObject({
  customerId: idSchema,
  kind: z.enum(['site', 'gbp']),
  capturedOn: dateSchema,
  capturedBy: text,
  source: text,
  name: text,
  address: text,
  phone: text,
  website: text.optional(),
  bookingUrl: text.optional(),
  hours: z.strictObject(
    Object.fromEntries(DAYS.map((d) => [d, rangesSchema])) as Record<
      (typeof DAYS)[number],
      typeof rangesSchema
    >,
  ),
  specialHours: z.array(z.strictObject({ date: dateSchema, ranges: rangesSchema })),
});
export type Profile = z.infer<typeof profileSchema>;

export interface Finding {
  field: string;
  site: string;
  gbp: string;
  /** notation は正規化すれば同じ（表記ゆれ）。mismatch と missing は承認して直す。 */
  kind: 'match' | 'notation' | 'mismatch' | 'missing';
}

const addressKey = (value: string) =>
  nfkc(value)
    .replace(/^〒?\s*\d{3}-?\d{4}\s*/, '')
    .replace(/(\d)\s*[‐‑‒–—―−ー－-]\s*(?=\d)/g, '$1-')
    .replace(/(\d+)丁目(\d+)番地?(\d+)号?/g, '$1-$2-$3')
    .replace(/(\d+)丁目(\d+)番地?/g, '$1-$2')
    .replace(/\s/g, '');
const formatRanges = (ranges: readonly { open: string; close: string }[]) =>
  ranges.length ? ranges.map((r) => `${r.open}-${r.close}`).join(', ') : '休業';

function compareValue(
  field: string,
  site: string | undefined,
  gbp: string | undefined,
  key: (v: string) => string,
): Finding {
  if (site === undefined || gbp === undefined)
    return {
      field,
      site: site ?? '（未設定）',
      gbp: gbp ?? '（未設定）',
      kind: site === gbp ? 'match' : 'missing',
    };
  if (site === gbp) return { field, site, gbp, kind: 'match' };
  return { field, site, gbp, kind: key(site) === key(gbp) ? 'notation' : 'mismatch' };
}

export function compareProfiles(site: Profile, gbp: Profile): Finding[] {
  if (site.kind !== 'site' || gbp.kind !== 'gbp')
    throw new OpsError('サイト側と GBP 側のプロフィールを渡してください');
  assertCustomer('gbp profile', site.customerId, gbp.customerId);
  const urlKey = (v: string) => {
    const url = canonicalUrl(v);
    return url && url !== 'invalid' ? url.key : `invalid:${v}`;
  };
  const findings = [
    compareValue('店名', site.name, gbp.name, (v) => nfkc(v).replace(/\s/g, '')),
    compareValue('住所', site.address, gbp.address, addressKey),
    compareValue('電話', site.phone, gbp.phone, (v) => normalizePhone(v)?.digits ?? v),
    compareValue('ウェブサイト', site.website, gbp.website, urlKey),
    compareValue('予約先', site.bookingUrl, gbp.bookingUrl, urlKey),
    ...DAYS.map((d) =>
      compareValue(
        `営業時間（${DAY_LABELS[d]}）`,
        formatRanges(site.hours[d]),
        formatRanges(gbp.hours[d]),
        (v) => v,
      ),
    ),
  ];
  const dates = [...new Set([...site.specialHours, ...gbp.specialHours].map((s) => s.date))].sort();
  for (const date of dates) {
    const s = site.specialHours.find((x) => x.date === date);
    const g = gbp.specialHours.find((x) => x.date === date);
    findings.push(
      compareValue(
        `臨時営業時間（${date}）`,
        s && formatRanges(s.ranges),
        g && formatRanges(g.ranges),
        (v) => v,
      ),
    );
  }
  return findings;
}

// ── 変更と、投稿・口コミ返信の記録 ────────────────────

const signoff = z.strictObject({ by: text, on: dateSchema });

const changeSchema = z
  .strictObject({
    id: idSchema,
    field: text,
    value: text,
    /** どちらを直すか。 */
    target: z.enum(['gbp', 'site']),
    proposed: signoff,
    approved: signoff.optional(),
    applied: signoff.extend({ evidence: text }).optional(),
  })
  .refine((c) => !c.applied || c.approved, '承認のない変更を反映済みにしません');

const taskSchema = z
  .strictObject({
    id: idSchema,
    kind: z.enum(['post', 'review_reply']),
    /** 返信する口コミの特定（投稿日・投稿者の表示名など）。返信だけ必須。 */
    reviewRef: text.optional(),
    dueOn: dateSchema,
    draft: text,
    status: z.enum(['draft', 'approved', 'done', 'cancelled']),
    approved: signoff.extend({ draftSha256: z.string().regex(/^[0-9a-f]{64}$/) }).optional(),
    done: signoff.extend({ evidence: text }).optional(),
    history: z.array(z.strictObject({ at: timestampSchema, by: text, action: text })).min(1),
  })
  .refine(
    (t) => t.kind === 'post' || t.reviewRef !== undefined,
    '口コミ返信には対象の口コミの特定が必要です',
  )
  .refine(
    (t) => (t.status === 'approved' || t.status === 'done') === (t.approved !== undefined),
    '承認の記録と状態が一致しません',
  )
  .refine(
    (t) => (t.status === 'done') === (t.done !== undefined),
    '実施の記録と状態が一致しません',
  );
type Task = z.infer<typeof taskSchema>;

const opsFileSchema = z.strictObject({
  customerId: idSchema,
  changes: z.array(changeSchema),
  tasks: z.array(taskSchema),
});
export type GbpOps = z.infer<typeof opsFileSchema>;

const validate = (file: unknown): GbpOps => {
  const parsed = opsFileSchema.safeParse(file);
  if (!parsed.success)
    throw new OpsError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  return parsed.data;
};
const findChange = (file: GbpOps, id: string) => {
  const change = file.changes.find((c) => c.id === id);
  if (!change) throw new OpsError(`変更がありません: ${id}`);
  return change;
};
const findTask = (file: GbpOps, id: string) => {
  const task = file.tasks.find((t) => t.id === id);
  if (!task) throw new OpsError(`投稿・返信がありません: ${id}`);
  return task;
};
const putTask = (file: GbpOps, task: Task) =>
  validate({ ...file, tasks: file.tasks.map((t) => (t.id === task.id ? task : t)) });

export function proposeChange(
  file: GbpOps,
  change: { id: string; field: string; value: string; target: string; by: string; on: string },
) {
  if (file.changes.some((c) => c.id === change.id))
    throw new OpsError(`変更 ID が重複: ${change.id}`);
  const { by, on, ...rest } = change;
  return validate({ ...file, changes: [...file.changes, { ...rest, proposed: { by, on } }] });
}

export function approveChange(file: GbpOps, id: string, by: { by: string; on: string }) {
  const change = findChange(file, id);
  if (change.approved) throw new OpsError('承認済みです');
  return validate({
    ...file,
    changes: file.changes.map((c) => (c.id === id ? { ...c, approved: by } : c)),
  });
}

export function recordChangeApplied(
  file: GbpOps,
  id: string,
  applied: { by: string; on: string; evidence: string },
) {
  const change = findChange(file, id);
  if (!change.approved) throw new OpsError('承認されていない変更は反映済みにできません');
  return validate({
    ...file,
    changes: file.changes.map((c) => (c.id === id ? { ...c, applied } : c)),
  });
}

export function draftTask(
  file: GbpOps,
  task: { id: string; kind: string; dueOn: string; draft: string; reviewRef?: string },
  meta: { at: string; by: string },
) {
  if (file.tasks.some((t) => t.id === task.id)) throw new OpsError(`ID が重複: ${task.id}`);
  return validate({
    ...file,
    tasks: [
      ...file.tasks,
      { ...task, status: 'draft', history: [{ ...meta, action: '下書きを作成' }] },
    ],
  });
}

/** 文面を直したら、承認は取り直す。 */
export function editDraft(
  file: GbpOps,
  id: string,
  draft: string,
  meta: { at: string; by: string },
) {
  const task = findTask(file, id);
  if (task.status === 'done' || task.status === 'cancelled')
    throw new OpsError('実施済み・取り消した記録は直しません');
  const { approved: _dropped, ...rest } = task;
  void _dropped;
  return putTask(file, {
    ...rest,
    draft,
    status: 'draft',
    history: [
      ...task.history,
      { ...meta, action: task.approved ? '文面を修正（承認を取り消し）' : '文面を修正' },
    ],
  });
}

export function approveTask(
  file: GbpOps,
  id: string,
  meta: { at: string; by: string; on: string },
) {
  const task = findTask(file, id);
  if (task.status !== 'draft') throw new OpsError('下書きだけを承認します');
  return putTask(file, {
    ...task,
    status: 'approved',
    approved: { by: meta.by, on: meta.on, draftSha256: sha256(task.draft) },
    history: [...task.history, { at: meta.at, by: meta.by, action: '承認' }],
  });
}

/** 人が GBP で実施したことの記録。承認した文面から変わっていれば記録しない。 */
export function recordTaskDone(
  file: GbpOps,
  id: string,
  done: { at: string; by: string; on: string; evidence: string },
) {
  const task = findTask(file, id);
  if (task.status !== 'approved' || !task.approved)
    throw new OpsError('承認されていない投稿・返信は実施済みにできません');
  if (task.approved.draftSha256 !== sha256(task.draft))
    throw new OpsError('承認した文面と現在の文面が違います');
  return putTask(file, {
    ...task,
    status: 'done',
    done: { by: done.by, on: done.on, evidence: done.evidence },
    history: [...task.history, { at: done.at, by: done.by, action: '実施を記録' }],
  });
}

export function dueTasks(file: GbpOps, today: string) {
  return file.tasks
    .filter((t) => t.status === 'draft' || t.status === 'approved')
    .map((t) => ({ task: t, overdue: t.dueOn < today }))
    .sort((a, b) => a.task.dueOn.localeCompare(b.task.dueOn));
}

export const gbpDir = (dataDir: string, customerId: string) => join(dataDir, 'gbp', customerId);

export function loadOps(dataDir: string, customerId: string): GbpOps {
  const path = join(gbpDir(dataDir, customerId), 'ops.json');
  if (!existsSync(path)) return { customerId, changes: [], tasks: [] };
  const file = readJson(path, opsFileSchema);
  assertCustomer(path, customerId, file.customerId);
  return file;
}
