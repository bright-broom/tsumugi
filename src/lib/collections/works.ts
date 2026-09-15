import { z } from 'zod';
import {
  blockSchema,
  bodyReadiness,
  dateSchema,
  entryReadiness,
  entryShape,
} from '@/lib/collections/core';

/**
 * A measurement is either a number with its period and source, or explicitly not measured.
 * There is no default value: an unmeasured figure can never be rendered as 0.
 */
const measurementSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('measured'),
    value: z.number().finite(),
    from: dateSchema,
    to: dateSchema,
    source: z.string(),
  }),
  z.object({ status: z.literal('not-measured'), note: z.string() }),
]);
export type Measurement = z.infer<typeof measurementSchema>;

const METRIC_KINDS = ['lcp', 'gbp-views', 'inquiries', 'reservations', 'cost'] as const;
const metricSchema = z.object({
  kind: z.enum(METRIC_KINDS),
  /** What exactly was counted, e.g. the portal fee per month or the page that was measured. */
  note: z.string(),
  before: measurementSchema,
  after: measurementSchema,
});
export type Metric = z.infer<typeof metricSchema>;

const PERMISSION_SCOPES = ['name', 'metrics', 'images', 'url', 'body'] as const;

/** Client work of this business, published only with a recorded permission. */
const workSchema = z.object({
  ...entryShape,
  client: z.object({ name: z.string(), industry: z.string(), area: z.string() }),
  permission: z.object({
    status: z.enum(['granted', 'pending', 'declined']),
    scope: z.array(z.enum(PERMISSION_SCOPES)),
    recordedAt: dateSchema.optional(),
    /** How the permission was obtained (signed form, e-mail…) and where the record is kept. */
    method: z.string(),
    note: z.string(),
  }),
  launchedAt: dateSchema.optional(),
  url: z
    .string()
    .regex(/^https:\/\/[^\s]+$/)
    .optional(),
  summary: z.string(),
  metrics: z.array(metricSchema),
  /** Verified results that are not numbers (e.g. "the owner updates opening hours without help"). */
  outcomes: z.array(z.string()),
  /** What did not work. The works page promises to publish these too. */
  setbacks: z.array(z.string()),
  body: z.array(blockSchema),
});
export const worksSchema = z.object({ entries: z.array(workSchema) });
export type Work = z.infer<typeof workSchema>;
export type WorksInput = z.input<typeof worksSchema>;

function measurementReadiness(label: string, measurement: Measurement): string[] {
  if (measurement.status === 'not-measured')
    return measurement.note.trim() ? [] : [`${label}: explain why it was not measured`];
  const problems: string[] = [];
  if (measurement.to < measurement.from) problems.push(`${label}: period ends before it starts`);
  if (!measurement.source.trim()) problems.push(`${label}: source is required`);
  return problems;
}

export function workReadiness(work: Work): string[] {
  const { permission } = work;
  const scoped = (scope: (typeof PERMISSION_SCOPES)[number]) => permission.scope.includes(scope);
  const problems = [...entryReadiness(work)];
  if (work.body.length) problems.push(...bodyReadiness(work.body));
  if (permission.status !== 'granted') problems.push('permission.status must be "granted"');
  if (!permission.recordedAt) problems.push('permission.recordedAt is required');
  if (!permission.method.trim()) problems.push('permission.method is required');
  if (work.metrics.length && !scoped('metrics'))
    problems.push('metrics need the "metrics" permission scope');
  if ((work.image || work.body.some((block) => block.type === 'image')) && !scoped('images'))
    problems.push('images need the "images" permission scope');
  if (work.url && !scoped('url')) problems.push('url needs the "url" permission scope');
  if (work.body.length && !scoped('body')) problems.push('body needs the "body" permission scope');
  if (!work.summary.trim()) problems.push('summary is empty');
  if (!work.client.industry.trim()) problems.push('client.industry is required');
  if (!work.metrics.length && !work.outcomes.some((outcome) => outcome.trim()))
    problems.push('record at least one metric or verified outcome');
  work.metrics.forEach((metric, index) => {
    const label = `metrics[${index}]`;
    problems.push(...measurementReadiness(`${label}.before`, metric.before));
    problems.push(...measurementReadiness(`${label}.after`, metric.after));
    if (
      metric.before.status === 'measured' &&
      metric.after.status === 'measured' &&
      metric.after.from <= metric.before.to
    )
      problems.push(`${label}: the after period must start after the before period ends`);
  });
  return problems;
}

/** A difference exists only when both sides were measured. */
export function metricDifference(metric: Metric): number | null {
  return metric.before.status === 'measured' && metric.after.status === 'measured'
    ? metric.after.value - metric.before.value
    : null;
}

export function clientName(work: Work): string | null {
  return work.permission.scope.includes('name') && work.client.name.trim() ? work.client.name : null;
}
