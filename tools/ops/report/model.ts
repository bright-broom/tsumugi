/**
 * 顧客向け月次レポートの下書き（Issue #29、ADR 0037）。
 * 指標（#28）・修正依頼と作業時間（#26）・手入力の GBP 実績から、対象月だけを集める。
 * 人が確認してから使う前提。ツールは送信・共有をしない。
 */
import { z } from 'zod';
import type { Block, DocumentModel } from '../shared/document';
import { compareMeasurements, formatMeasurement, type MetricSummary } from '../metrics/model';
import {
  type RequestsFile,
  STATUS_LABELS,
  allowanceFor,
  monthlyWork,
  openRequests,
  threeMonthAverage,
} from '../requests/model';
import { sha256 } from '../shared/cli';
import { OpsError, assertCustomer, idSchema } from '../shared/store';
import { dateSchema, monthRange, monthSchema, shiftMonth, timestampSchema } from '../shared/time';

/** GBP の管理画面を見て手で転記した実績。項目名は画面の表記をそのまま使い、ツールでは決めない。 */
export const gbpPerformanceSchema = z
  .strictObject({
    customerId: idSchema,
    month: monthSchema,
    source: z.string().trim().min(1),
    enteredBy: z.string().trim().min(1),
    enteredOn: dateSchema,
    items: z
      .array(
        z.strictObject({
          label: z.string().trim().min(1),
          /** null は未入力（確認できなかった）。0 とは区別する。 */
          value: z.int().min(0).nullable(),
          note: z.string().trim().min(1).optional(),
        }),
      )
      .min(1),
  })
  .superRefine((file, ctx) => {
    const labels = new Set<string>();
    file.items.forEach((item, i) => {
      if (labels.has(item.label))
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'label'],
          message: `項目が重複: ${item.label}`,
        });
      labels.add(item.label);
    });
  });
export type GbpPerformance = z.infer<typeof gbpPerformanceSchema>;

export interface ReportInput {
  customerId: string;
  customerLabel: string;
  month: string;
  generatedAt: string;
  today: string;
  metrics: readonly MetricSummary[];
  previousMetrics: readonly MetricSummary[];
  requests: RequestsFile | null;
  gbp: GbpPerformance | null;
  previousGbp: GbpPerformance | null;
  /** 継続支援のキー。変更枠との比較に使う。 */
  plan: string | null;
  notes: readonly string[];
}

const minutes = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}分`;
const shorten = (text: string) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

export function buildMonthlyReport(input: ReportInput): {
  document: DocumentModel;
  actions: string[];
} {
  const range = monthRange(input.month);
  const previousMonth = shiftMonth(input.month, -1);
  const previousRange = monthRange(previousMonth);
  // 取り違え・混在の検査。1 つでも合わなければ書かない。
  if (input.requests) assertCustomer('requests', input.customerId, input.requests.customerId);
  for (const [gbp, month] of [
    [input.gbp, input.month],
    [input.previousGbp, previousMonth],
  ] as const) {
    if (!gbp) continue;
    assertCustomer(`gbp ${gbp.month}`, input.customerId, gbp.customerId);
    if (gbp.month !== month)
      throw new OpsError(`GBP の実績の月が違います（${month} のはずが ${gbp.month}）`);
  }
  for (const [list, expected] of [
    [input.metrics, range],
    [input.previousMetrics, previousRange],
  ] as const)
    for (const s of list)
      if (s.period.from !== expected.from || s.period.to !== expected.to)
        throw new OpsError(`指標 ${s.metric} の期間が対象月と違います`);

  const actions: string[] = [];
  const blocks: Block[] = [
    {
      kind: 'notice',
      text: 'これは確認前の下書きです。数値の出所・欠損・対応事項を確認してから、お客様へお渡しください。',
    },
    {
      kind: 'table',
      head: ['項目', '内容'],
      rows: [
        ['お客様', `${input.customerLabel} 様`],
        ['対象期間', `${range.from}〜${range.to}`],
        ['作成', input.generatedAt],
        ['状態', '下書き（未確認）'],
      ],
    },
    { kind: 'heading', text: 'サイトの指標' },
    {
      kind: 'table',
      head: ['指標', '今月', '前月', '前月との比較'],
      rows: input.metrics.map((s) => {
        const p = input.previousMetrics.find((x) => x.metric === s.metric);
        if (s.measurement.status === 'missing')
          actions.push(`${s.label}：${s.measurement.reason}。取り込み漏れか計測の停止かを確認する`);
        return [
          s.label,
          formatMeasurement(s.measurement, s.unit),
          p ? formatMeasurement(p.measurement, p.unit) : '未計測',
          p
            ? compareMeasurements(s.measurement, p.measurement, s.unit)
            : '比較できません（前月は未計測）',
        ];
      }),
    },
    {
      kind: 'paragraph',
      text: '「未計測」は計測していないこと、「欠損あり」は計測しているのにデータが欠けていることを表します。どちらも 0 件ではありません。',
    },
    { kind: 'heading', text: '数値の出所' },
    {
      kind: 'list',
      items: input.metrics.map((s) => {
        if (!s.source) return `${s.label}：データ源なし`;
        const files = s.imports
          .map((i) => `${i.fileName}（${i.period.from}〜${i.period.to}）`)
          .join('、');
        const breakdown =
          s.measurement.status === 'measured' && Object.keys(s.measurement.breakdown).length > 1
            ? `／内訳 ${Object.entries(s.measurement.breakdown)
                .map(([k, v]) => `${k} ${v}`)
                .join('・')}`
            : '';
        return `${s.label}：${s.source.label}（定義：${s.source.definition}）／取り込み ${files || 'なし'}${breakdown}`;
      }),
    },
    { kind: 'heading', text: 'Google ビジネスプロフィール（手入力の実績）' },
  ];

  if (!input.gbp) {
    blocks.push({ kind: 'paragraph', text: '今月の実績は入力されていません（未計測）。' });
    actions.push('GBP の今月の実績が未入力');
  } else {
    const previous = input.previousGbp;
    blocks.push(
      {
        kind: 'table',
        head: ['項目', '今月', '前月', '前月との比較'],
        rows: input.gbp.items.map((item) => {
          const before = previous?.items.find((x) => x.label === item.label);
          if (item.value === null) actions.push(`GBP「${item.label}」が未入力`);
          const now = item.value === null ? '未入力' : String(item.value);
          const prev = !before ? '未計測' : before.value === null ? '未入力' : String(before.value);
          const compare =
            item.value !== null && before?.value != null
              ? item.value === before.value
                ? '前月と同じ'
                : `前月比 ${item.value > before.value ? '+' : '−'}${Math.abs(item.value - before.value)}`
              : '比較できません';
          return [item.label, now, prev, compare];
        }),
      },
      {
        kind: 'paragraph',
        text: `出所：${input.gbp.source}（入力 ${input.gbp.enteredBy}、${input.gbp.enteredOn}）`,
      },
    );
  }

  blocks.push({ kind: 'heading', text: '修正作業と作業時間' });
  if (!input.requests) {
    blocks.push({ kind: 'paragraph', text: '修正依頼の記録がありません（未記録）。' });
  } else {
    const work = monthlyWork(input.requests, input.month);
    const average = threeMonthAverage(input.requests, input.month);
    if (!work.tracked) {
      blocks.push({
        kind: 'paragraph',
        text: `この月は記録開始（${input.requests.trackingSince}）より前です（未記録）。`,
      });
    } else {
      blocks.push(
        work.byRequest.length
          ? {
              kind: 'table',
              head: ['依頼', '内容', '状態', '今月の作業'],
              rows: work.byRequest.map((r) => [
                r.id,
                shorten(r.description),
                STATUS_LABELS[r.status],
                minutes(r.minutes),
              ]),
            }
          : { kind: 'paragraph', text: '今月の作業記録は 0 分です。' },
      );
      const summary = [
        `今月の作業時間：${minutes(work.rawMinutes)}（月の合計を 5 分単位で切り上げて ${minutes(work.billedMinutes)}）${work.partial ? '。記録開始が月の途中のため、月初からの合計ではありません' : ''}`,
        average.averageMinutes === null
          ? '3 か月平均：記録が 3 か月分そろっていないため出しません'
          : `3 か月平均：${minutes(average.averageMinutes)}`,
      ];
      if (input.plan) {
        const allowance = allowanceFor(input.plan);
        summary.push(`「${allowance.name}」の変更枠：月 ${minutes(allowance.minutes)}`);
        if (work.billedMinutes > allowance.minutes)
          actions.push(
            `作業時間 ${minutes(work.billedMinutes)} が「${allowance.name}」の変更枠 ${minutes(allowance.minutes)} を超えています。次月対応か追加見積もりの選択を確認する`,
          );
      }
      blocks.push({ kind: 'list', items: summary });
    }
    for (const { request, overdue } of openRequests(input.requests, input.today))
      actions.push(
        `依頼 ${request.id}「${shorten(request.description)}」：${STATUS_LABELS[request.status]}${request.dueOn ? `（期限 ${request.dueOn}${overdue ? '・期限超過' : ''}）` : ''}`,
      );
    for (const r of input.requests.requests)
      if (r.status === 'done' && !r.completionNotice)
        actions.push(`依頼 ${r.id}：完了連絡の記録がない`);
  }

  actions.push(...input.notes);
  blocks.push(
    { kind: 'heading', text: '対応事項' },
    actions.length ? { kind: 'list', items: actions } : { kind: 'paragraph', text: 'ありません。' },
  );
  return { document: { title: `月次レポート ${input.month}（下書き）`, blocks }, actions };
}

// ── 確認の記録 ──────────────────────────────────────

export const approvalSchema = z.strictObject({
  customerId: idSchema,
  month: monthSchema,
  draftFile: z.string(),
  draftSha256: z.string().regex(/^[0-9a-f]{64}$/),
  approvedBy: z.string().trim().min(1),
  approvedAt: timestampSchema,
});
export type Approval = z.infer<typeof approvalSchema>;

/** 確認した後に下書きを作り直していれば、確認は無効。 */
export function approvalStatus(
  draft: string,
  approval: Approval | null,
): 'unapproved' | 'approved' | 'stale' {
  if (!approval) return 'unapproved';
  return approval.draftSha256 === sha256(draft) ? 'approved' : 'stale';
}
