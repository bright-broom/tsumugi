/**
 * 顧客運用の指標（Issue #28、ADR 0037）。
 * 「0 件（計測して 0）」「未計測（データ源がない・計測期間外）」「欠損（計測しているがデータが欠けた）」を型で分ける。
 * 紬の営業サイトには計測タグを入れない。取り込むのは、顧客が同意したデータ源の集計 CSV だけ。
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { readCsvRecords } from '../shared/csv';
import { OpsError, assertCustomer, idSchema, readJson } from '../shared/store';
import { dateSchema, datesBetween, jstDate, monthRange, timestampSchema } from '../shared/time';

const METRICS = ['page_views', 'visits', 'referrals', 'inquiries', 'bookings'] as const;
type MetricKey = (typeof METRICS)[number];
const metricSchema = z.enum(METRICS);

type Shape = 'daily' | 'event';
const METRIC_INFO: Record<MetricKey, { label: string; unit: string; shape: Shape }> = {
  page_views: { label: '閲覧数', unit: '回', shape: 'daily' },
  visits: { label: '訪問数', unit: '回', shape: 'daily' },
  referrals: { label: '流入（参照元別）', unit: '回', shape: 'daily' },
  inquiries: { label: '問い合わせ', unit: '件', shape: 'event' },
  bookings: { label: '予約', unit: '件', shape: 'event' },
};
const KIND_SHAPE = { server_log_aggregate: 'daily', event_log: 'event' } as const;

interface Period {
  from: string;
  to?: string | undefined;
}
const OPEN_END = '9999-12-31';
const overlaps = (a: Period, b: Period) =>
  a.from <= (b.to ?? OPEN_END) && b.from <= (a.to ?? OPEN_END);
const contains = (p: Period, date: string) => p.from <= date && date <= (p.to ?? OPEN_END);

const periodSchema = z
  .strictObject({ from: dateSchema, to: dateSchema })
  .refine((p) => p.from <= p.to, '期間の始まりが終わりより後です');

const sourceSchema = z.strictObject({
  id: idSchema,
  kind: z.enum(['server_log_aggregate', 'event_log']),
  label: z.string().min(1),
  metrics: z.array(metricSchema).min(1),
  /** 指標の定義（例：ボットを除く条件、問い合わせに数える経路）。レポートに出所として出す。 */
  definition: z.string().min(1),
  /** 顧客の同意の記録。同意のないデータ源は登録しない。 */
  consent: z.strictObject({
    recordedOn: dateSchema,
    recordedBy: z.string().min(1),
    scope: z.string().min(1),
  }),
  coverage: z.strictObject({ from: dateSchema, to: dateSchema.optional() }),
});

export const sourcesFileSchema = z
  .strictObject({ customerId: idSchema, sources: z.array(sourceSchema) })
  .superRefine((file, ctx) => {
    const ids = new Set<string>();
    file.sources.forEach((s, i) => {
      if (ids.has(s.id))
        ctx.addIssue({ code: 'custom', path: ['sources', i, 'id'], message: `ID が重複: ${s.id}` });
      ids.add(s.id);
      for (const m of s.metrics)
        if (METRIC_INFO[m].shape !== KIND_SHAPE[s.kind])
          ctx.addIssue({
            code: 'custom',
            path: ['sources', i, 'metrics'],
            message: `${s.kind} では ${m} を数えられません`,
          });
      if (s.coverage.to && s.coverage.to < s.coverage.from)
        ctx.addIssue({ code: 'custom', path: ['sources', i, 'coverage'], message: '期間が逆です' });
      file.sources.slice(0, i).forEach((other) => {
        const shared = s.metrics.filter((m) => other.metrics.includes(m));
        if (shared.length && overlaps(s.coverage, other.coverage))
          ctx.addIssue({
            code: 'custom',
            path: ['sources', i],
            message: `${other.id} と ${s.id} が同じ期間に ${shared.join(', ')} を持っています。二重計上になるので期間を分けてください`,
          });
      });
    });
  });
export type SourcesFile = z.infer<typeof sourcesFileSchema>;

const importFileSchema = z.strictObject({
  customerId: idSchema,
  sourceId: idSchema,
  fileName: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  importedAt: timestampSchema,
  /** このファイルが網羅している期間。期間内で行がない日は、日次集計なら欠損、記録なら 0 件。 */
  period: periodSchema,
  daily: z.array(
    z.strictObject({
      date: dateSchema,
      metric: metricSchema,
      dimension: z.string(),
      value: z.int().min(0).nullable(),
    }),
  ),
  events: z.array(
    z.strictObject({
      ref: z.string().min(1),
      date: dateSchema,
      metric: metricSchema,
      channel: z.string(),
    }),
  ),
});
export type ImportFile = z.infer<typeof importFileSchema>;

export function createImport(args: {
  sources: SourcesFile;
  existing: readonly ImportFile[];
  sourceId: string;
  fileName: string;
  text: string;
  sha256: string;
  period: { from: string; to: string };
  importedAt: string;
}): ImportFile {
  const { sources, existing, period } = args;
  const source = sources.sources.find((s) => s.id === args.sourceId);
  if (!source) throw new OpsError(`データ源が登録されていません: ${args.sourceId}`);
  if (!periodSchema.safeParse(period).success) throw new OpsError('取り込む期間が正しくありません');
  if (!contains(source.coverage, period.from) || !contains(source.coverage, period.to))
    throw new OpsError(`取り込む期間が、データ源 ${source.id} の計測期間（同意の範囲）の外です`);
  const same = existing.find((i) => i.sha256 === args.sha256);
  if (same) throw new OpsError(`同じ内容のファイルは取り込み済みです（${same.fileName}）`);
  const overlap = existing.find((i) => i.sourceId === source.id && overlaps(i.period, period));
  if (overlap)
    throw new OpsError(
      `${overlap.fileName}（${overlap.period.from}〜${overlap.period.to}）と期間が重なります。二重計上を避けるため、先に取り消してください`,
    );

  const inPeriod = (date: string, line: number) => {
    if (!contains(period, date)) throw new OpsError(`${line} 行目: ${date} は取り込む期間の外です`);
  };
  const metricOf = (value: string, line: number) => {
    const metric = metricSchema.safeParse(value);
    if (!metric.success || !source.metrics.includes(metric.data))
      throw new OpsError(`${line} 行目: データ源 ${source.id} の指標ではありません: ${value}`);
    return metric.data;
  };

  const result: ImportFile = {
    customerId: sources.customerId,
    sourceId: source.id,
    fileName: args.fileName,
    sha256: args.sha256,
    importedAt: args.importedAt,
    period,
    daily: [],
    events: [],
  };
  if (source.kind === 'server_log_aggregate') {
    const keys = new Set<string>();
    for (const { line, values } of readCsvRecords(args.text, [
      'date',
      'metric',
      'dimension',
      'value',
    ])) {
      if (!dateSchema.safeParse(values.date).success)
        throw new OpsError(`${line} 行目: 日付が読めません`);
      const date = values.date!;
      inPeriod(date, line);
      const metric = metricOf(values.metric!, line);
      const raw = values.value!;
      if (raw !== '' && !/^\d+$/.test(raw))
        throw new OpsError(`${line} 行目: 値は 0 以上の整数か、欠損を表す空欄です`);
      const key = JSON.stringify([date, metric, values.dimension]);
      if (keys.has(key)) throw new OpsError(`${line} 行目: 同じ日・指標・区分の行が重複しています`);
      keys.add(key);
      result.daily.push({
        date,
        metric,
        dimension: values.dimension!,
        value: raw === '' ? null : Number(raw),
      });
    }
  } else {
    const refs = new Set<string>();
    for (const { line, values } of readCsvRecords(args.text, [
      'occurred_at',
      'metric',
      'channel',
      'ref',
    ])) {
      let date: string;
      try {
        date = jstDate(values.occurred_at!);
      } catch (error) {
        throw new OpsError(`${line} 行目: ${(error as Error).message}`);
      }
      inPeriod(date, line);
      const metric = metricOf(values.metric!, line);
      const ref = values.ref!;
      if (!ref)
        throw new OpsError(`${line} 行目: ref（受付番号など）が空です。重複を見分けられません`);
      if (refs.has(ref)) throw new OpsError(`${line} 行目: ref が重複しています: ${ref}`);
      refs.add(ref);
      result.events.push({ ref, date, metric, channel: values.channel! });
    }
  }
  return result;
}

export type Measurement =
  | { status: 'measured'; value: number; breakdown: Record<string, number> }
  | { status: 'not_measured'; reason: string }
  | { status: 'missing'; reason: string; missingDates: string[]; partialValue: number };

export interface MetricSummary {
  metric: MetricKey;
  label: string;
  unit: string;
  period: { from: string; to: string };
  measurement: Measurement;
  source: { id: string; label: string; definition: string } | null;
  imports: {
    fileName: string;
    sha256: string;
    importedAt: string;
    period: { from: string; to: string };
  }[];
}

const describeDates = (dates: readonly string[]) =>
  dates.length <= 3 ? dates.join('、') : `${dates[0]}〜${dates.at(-1)} の範囲`;

/** 月単位の集計。他の顧客のファイルが混ざっていれば止める。 */
export function summarizeMonth(
  customerId: string,
  month: string,
  sources: SourcesFile,
  imports: readonly ImportFile[],
): MetricSummary[] {
  assertCustomer('metrics sources', customerId, sources.customerId);
  for (const i of imports) assertCustomer(`metrics import ${i.fileName}`, customerId, i.customerId);
  const range = monthRange(month);

  return METRICS.map((metric) => {
    const info = METRIC_INFO[metric];
    const base = { metric, label: info.label, unit: info.unit, period: range };
    const candidates = sources.sources.filter((s) => s.metrics.includes(metric));
    const source = candidates.find((s) => overlaps(s.coverage, range));
    if (!source)
      return {
        ...base,
        measurement: {
          status: 'not_measured',
          reason: candidates.length ? 'この月は計測期間外です' : 'データ源が登録されていません',
        },
        source: null,
        imports: [],
      } satisfies MetricSummary;

    const used = imports.filter((i) => i.sourceId === source.id && overlaps(i.period, range));
    const missingDates: string[] = [];
    const breakdown: Record<string, number> = {};
    let value = 0;
    for (const date of datesBetween(range.from, range.to)) {
      const covering = used.filter((i) => contains(i.period, date));
      if (covering.length > 1)
        throw new OpsError(
          `${date} を含む取り込みが複数あります（${covering.map((i) => i.fileName).join('、')}）。二重計上になるため集計しません`,
        );
      const file = covering[0];
      if (!contains(source.coverage, date) || !file) {
        missingDates.push(date);
        continue;
      }
      if (info.shape === 'daily') {
        const rows = file.daily.filter((r) => r.date === date && r.metric === metric);
        if (!rows.length || rows.some((r) => r.value === null)) {
          missingDates.push(date);
          continue;
        }
        for (const r of rows) {
          value += r.value!;
          const key = r.dimension || '（区分なし）';
          breakdown[key] = (breakdown[key] ?? 0) + r.value!;
        }
      } else {
        for (const e of file.events.filter((e) => e.date === date && e.metric === metric)) {
          value += 1;
          const key = e.channel || '（経路なし）';
          breakdown[key] = (breakdown[key] ?? 0) + 1;
        }
      }
    }
    const measurement: Measurement = missingDates.length
      ? {
          status: 'missing',
          reason: `${missingDates.length} 日分のデータがありません（${describeDates(missingDates)}）`,
          missingDates,
          partialValue: value,
        }
      : { status: 'measured', value, breakdown };
    return {
      ...base,
      measurement,
      source: { id: source.id, label: source.label, definition: source.definition },
      imports: used.map(({ fileName, sha256, importedAt, period }) => ({
        fileName,
        sha256,
        importedAt,
        period,
      })),
    };
  });
}

/** 表示用。0 件と未計測・欠損を同じ見た目にしない。欠損した月の途中までの値は合計として出さない。 */
export function formatMeasurement(m: Measurement, unit: string): string {
  if (m.status === 'measured') return `${m.value.toLocaleString('en-US')}${unit}`;
  if (m.status === 'not_measured') return `未計測（${m.reason}）`;
  return `欠損あり（${m.reason}）`;
}

export function compareMeasurements(
  current: Measurement,
  previous: Measurement,
  unit: string,
): string {
  if (current.status === 'measured' && previous.status === 'measured') {
    const delta = current.value - previous.value;
    return delta === 0
      ? `前月と同じ`
      : `前月比 ${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('en-US')}${unit}`;
  }
  const which = current.status !== 'measured' ? '今月' : '前月';
  const state =
    (current.status !== 'measured' ? current : previous).status === 'missing'
      ? '欠損あり'
      : '未計測';
  return `比較できません（${which}は${state}）`;
}

export const metricsDir = (dataDir: string, customerId: string) =>
  join(dataDir, 'metrics', customerId);

export function loadCustomerMetrics(
  dataDir: string,
  customerId: string,
): { sources: SourcesFile; imports: ImportFile[] } {
  const dir = metricsDir(dataDir, customerId);
  const sourcesPath = join(dir, 'sources.json');
  if (!existsSync(sourcesPath)) return { sources: { customerId, sources: [] }, imports: [] };
  const sources = readJson(sourcesPath, sourcesFileSchema);
  assertCustomer(sourcesPath, customerId, sources.customerId);
  const importsDir = join(dir, 'imports');
  const imports = existsSync(importsDir)
    ? readdirSync(importsDir)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => {
          const path = join(importsDir, name);
          const file = readJson(path, importFileSchema);
          assertCustomer(path, customerId, file.customerId);
          return file;
        })
    : [];
  return { sources, imports };
}
