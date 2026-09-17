/**
 * 案件別の見積もり（Issue #25、ADR 0036）。
 * 金額と計算は src/content/prices.ts だけから引く。手入力の金額は受け付けない。
 */
import { z } from 'zod';
import {
  EXTERNAL_MONTHLY_ESTIMATE,
  OPTIONS,
  RUN,
  RUN_TERM,
  paymentSchedule,
  productionPlans,
  withTax,
} from '@/content/prices';
import { sha256 } from '../shared/cli';
import { idSchema, OpsError } from '../shared/store';
import { dateSchema, timestampSchema } from '../shared/time';

export interface PriceCatalog {
  production: readonly { key: string; name: string; price: number; preparing: boolean }[];
  options: readonly {
    key: string;
    name: string;
    price: number;
    firm: boolean;
    note: string;
    preparing: boolean;
  }[];
  support: readonly { key: string; name: string; price: number }[];
  externalMonthly: number;
  supportTerm: string;
}

/** 公開サイトと同じ料金表。テストでは端数の検査のために架空の表を渡せる。 */
export function siteCatalog(): PriceCatalog {
  return {
    production: productionPlans().map((p) => ({
      key: p.key,
      name: p.name,
      price: p.price,
      preparing: 'preparing' in p && p.preparing,
    })),
    options: OPTIONS.map(({ key, name, price, firm, note, preparing }) => ({
      key,
      name,
      price,
      firm,
      note,
      preparing,
    })),
    support: RUN.map(({ key, name, price }) => ({ key, name, price })),
    externalMonthly: EXTERNAL_MONTHLY_ESTIMATE,
    supportTerm: RUN_TERM,
  };
}

/** 料金表の金額・区分だけから作る指紋。保存後に料金表が変わったことを検出する。 */
export const catalogFingerprint = (c: PriceCatalog) =>
  sha256(
    JSON.stringify([
      c.production.map((p) => [p.key, p.price, p.preparing]),
      c.options.map((o) => [o.key, o.price, o.firm, o.preparing]),
      c.support.map((s) => [s.key, s.price]),
      c.externalMonthly,
    ]),
  );

export const estimateInputSchema = z
  .strictObject({
    estimateId: idSchema,
    customerId: idSchema.optional(),
    projectId: idSchema.optional(),
    customerLabel: z.string().trim().min(1).max(120),
    issuedOn: dateSchema,
    validUntil: dateSchema,
    /** null は制作なし（継続支援だけの見積もり）。 */
    production: z.string().nullable(),
    options: z
      .array(z.strictObject({ key: z.string(), quantity: z.int().min(1).max(99) }))
      .default([]),
    support: z.string(),
    months: z.int().min(0).max(120),
    payment: z.literal('deposit_acceptance', {
      error:
        '支払方法は deposit_acceptance（着手時・検収時の2回）だけです。自社の分割払いは受け付けません',
    }),
    assumptions: z.array(z.string().trim().min(1)).default([]),
    unconfirmed: z.array(z.string().trim().min(1)).default([]),
  })
  .refine((v) => v.validUntil >= v.issuedOn, {
    message: '有効期限が発行日より前です',
    path: ['validUntil'],
  });
export type EstimateInput = z.output<typeof estimateInputSchema>;

const certaintySchema = z.enum(['fixed', 'reference', 'provisional']);
export type Certainty = z.infer<typeof certaintySchema>;

const lineSchema = z.object({
  id: z.string(),
  group: z.enum(['initial', 'monthly', 'external']),
  label: z.string(),
  unitPrice: z.int(),
  quantity: z.int(),
  amount: z.int(),
  certainty: certaintySchema,
  basis: z.string(),
});
type EstimateLine = z.infer<typeof lineSchema>;

const invoiceSchema = z.object({
  label: z.string(),
  subtotal: z.int(),
  tax: z.int(),
  total: z.int(),
  certainty: certaintySchema,
});

const resultSchema = z.object({
  lines: z.array(lineSchema),
  productionSubtotal: z.int(),
  optionsSubtotal: z.int(),
  initialSubtotal: z.int(),
  initialTotal: z.int(),
  monthlySubtotal: z.int(),
  monthlyTotal: z.int(),
  externalSubtotal: z.int(),
  externalTotal: z.int(),
  months: z.int(),
  periodSubtotal: z.int(),
  periodTotal: z.int(),
  invoices: z.array(invoiceSchema),
  provisional: z.boolean(),
  notes: z.array(z.string()),
  blockers: z.array(z.string()),
});
export type EstimateResult = z.infer<typeof resultSchema>;

const taxed = (label: string, subtotal: number, certainty: Certainty) => {
  const total = withTax(subtotal);
  return { label, subtotal, tax: total - subtotal, total, certainty };
};

export function calculateEstimate(
  input: EstimateInput,
  catalog: PriceCatalog = siteCatalog(),
): EstimateResult {
  const lines: EstimateLine[] = [];
  const notes: string[] = [];
  const blockers: string[] = [];

  const production =
    input.production === null ? null : catalog.production.find((p) => p.key === input.production);
  if (input.production !== null && !production)
    throw new OpsError(`制作プランがありません: ${input.production}`);
  if (production) {
    lines.push({
      id: `production:${production.key}`,
      group: 'initial',
      label: production.name,
      unitPrice: production.price,
      quantity: 1,
      amount: production.price,
      certainty: 'fixed',
      basis: `prices.ts productionPlans() key=${production.key}`,
    });
    if (production.preparing !== false)
      blockers.push(`「${production.name}」は受付準備中のため、見積書として発行できません`);
  }

  const seen = new Set<string>();
  for (const selected of input.options) {
    const option = catalog.options.find((o) => o.key === selected.key);
    if (!option) throw new OpsError(`オプションがありません: ${selected.key}`);
    if (seen.has(option.key))
      throw new OpsError(`オプションが重複しています: ${option.key}（数量で指定してください）`);
    seen.add(option.key);
    lines.push({
      id: `option:${option.key}`,
      group: 'initial',
      label: option.name,
      unitPrice: option.price,
      quantity: selected.quantity,
      amount: option.price * selected.quantity,
      certainty: option.firm ? 'fixed' : 'reference',
      basis: `prices.ts OPTIONS key=${option.key}`,
    });
    if (option.preparing !== false)
      blockers.push(
        `「${option.name}」は受付準備中または提供状態が未確認のため、見積書として発行できません`,
      );
    if (!option.firm) notes.push(`${option.name}：金額は目安です。${option.note}`);
  }
  if (input.options.length) notes.push('オプションの請求時期は、ご契約時に確定します');

  const support = catalog.support.find((s) => s.key === input.support);
  if (!support) throw new OpsError(`継続支援のプランがありません: ${input.support}`);
  lines.push({
    id: `support:${support.key}`,
    group: 'monthly',
    label: support.name,
    unitPrice: support.price,
    quantity: 1,
    amount: support.price,
    certainty: 'fixed',
    basis: `prices.ts RUN key=${support.key}`,
  });
  lines.push({
    id: 'external',
    group: 'external',
    label: '外部サービス費（サーバー・ドメイン等）',
    unitPrice: catalog.externalMonthly,
    quantity: 1,
    amount: catalog.externalMonthly,
    certainty: 'provisional',
    basis: 'prices.ts EXTERNAL_MONTHLY_ESTIMATE',
  });
  notes.push(
    '外部サービス費は仮置きの概算です。お客様が直接ご契約し、契約先・利用量を確認して置き換えます',
  );
  if (input.months > 0)
    notes.push(
      `継続支援は${catalog.supportTerm}のご契約です。期間の総額は${input.months}か月続けた場合の試算です`,
    );

  const sum = (group: EstimateLine['group'], idPrefix = '') =>
    lines
      .filter((l) => l.group === group && l.id.startsWith(idPrefix))
      .reduce((a, l) => a + l.amount, 0);
  const productionSubtotal = sum('initial', 'production:');
  const optionsSubtotal = sum('initial', 'option:');
  const monthlySubtotal = sum('monthly');
  const externalSubtotal = sum('external');

  // 税は請求ごとに計算する。合計に一度だけ掛けた額とは 1 円ずれることがある。
  const invoices = [];
  if (production) {
    const { deposit, acceptance } = paymentSchedule(productionSubtotal);
    invoices.push(taxed('着手時（制作本体）', deposit, 'fixed'));
    invoices.push(taxed('検収時（制作本体）', acceptance, 'fixed'));
  }
  if (optionsSubtotal > 0) {
    const certainty = lines.some((l) => l.id.startsWith('option:') && l.certainty !== 'fixed')
      ? 'reference'
      : 'fixed';
    invoices.push(taxed('オプション（請求時期はご契約時に確定）', optionsSubtotal, certainty));
  }
  const monthlyInvoice = taxed(
    `毎月の継続支援（${catalog.supportTerm}）`,
    monthlySubtotal,
    'fixed',
  );
  invoices.push(monthlyInvoice);

  const initialSubtotal = productionSubtotal + optionsSubtotal;
  const initialTotal = invoices
    .filter((i) => i !== monthlyInvoice)
    .reduce((a, i) => a + i.total, 0);
  const externalTotal = withTax(externalSubtotal);

  return {
    lines,
    productionSubtotal,
    optionsSubtotal,
    initialSubtotal,
    initialTotal,
    monthlySubtotal,
    monthlyTotal: monthlyInvoice.total,
    externalSubtotal,
    externalTotal,
    months: input.months,
    periodSubtotal: initialSubtotal + (monthlySubtotal + externalSubtotal) * input.months,
    periodTotal: initialTotal + (monthlyInvoice.total + externalTotal) * input.months,
    invoices,
    provisional: lines.some((l) => l.certainty !== 'fixed'),
    notes: [...notes, ...input.unconfirmed],
    blockers,
  };
}

// ── 版の保存 ──────────────────────────────────────

const versionSchema = z.object({
  version: z.int().min(1),
  savedAt: timestampSchema,
  note: z.string().optional(),
  catalogFingerprint: z.string(),
  input: estimateInputSchema,
  result: resultSchema,
});
export type EstimateVersion = z.infer<typeof versionSchema>;

export const estimateFileSchema = z.object({
  estimateId: idSchema,
  versions: z.array(versionSchema).min(1),
});
export type EstimateFile = z.infer<typeof estimateFileSchema>;

/** 新しい版を足す。発行できない見積もり・前の版と同じ内容・期限切れは保存しない。 */
export function appendVersion(
  file: EstimateFile | null,
  input: EstimateInput,
  options: { catalog?: PriceCatalog; savedAt: string; today: string; note?: string },
): EstimateFile {
  const catalog = options.catalog ?? siteCatalog();
  const result = calculateEstimate(input, catalog);
  if (result.blockers.length) throw new OpsError(result.blockers.join('\n'));
  if (input.validUntil < options.today)
    throw new OpsError(`有効期限（${input.validUntil}）が今日（${options.today}）より前です`);
  if (file && file.estimateId !== input.estimateId)
    throw new OpsError(`見積番号が違います: ${file.estimateId} と ${input.estimateId}`);
  if (!input.customerId || !input.projectId)
    throw new OpsError(
      '保存には customerId と projectId が必要です。旧見積は内容を確認して新しい見積番号で保存してください',
    );
  if (
    file?.versions.some(
      (v) =>
        v.input.estimateId !== file.estimateId ||
        v.input.customerId !== input.customerId ||
        v.input.projectId !== input.projectId,
    )
  )
    throw new OpsError(
      '見積の顧客・案件または番号が一致しません。旧見積の帰属は推定せず、新しい見積番号を使ってください',
    );
  const last = file?.versions.at(-1);
  if (
    last &&
    last.catalogFingerprint === catalogFingerprint(catalog) &&
    JSON.stringify(last.input) === JSON.stringify(input)
  )
    throw new OpsError(`第${last.version}版と同じ内容です。新しい版は作りません`);
  return {
    estimateId: input.estimateId,
    versions: [
      ...(file?.versions ?? []),
      {
        version: (last?.version ?? 0) + 1,
        savedAt: options.savedAt,
        ...(options.note ? { note: options.note } : {}),
        catalogFingerprint: catalogFingerprint(catalog),
        input,
        result,
      },
    ],
  };
}

export function findVersion(file: EstimateFile, version?: number): EstimateVersion {
  const found =
    version === undefined ? file.versions.at(-1) : file.versions.find((v) => v.version === version);
  if (!found) throw new OpsError(`${file.estimateId} に第${version}版はありません`);
  return found;
}

export interface EstimateDiff {
  from: number;
  to: number;
  lines: {
    label: string;
    change: 'added' | 'removed' | 'changed';
    before: number;
    after: number;
  }[];
  totals: { label: string; before: number; after: number; delta: number }[];
  fields: { label: string; before: string; after: string }[];
}

export function diffVersions(a: EstimateVersion, b: EstimateVersion): EstimateDiff {
  const lines: EstimateDiff['lines'] = [];
  const beforeById = new Map(a.result.lines.map((l) => [l.id, l]));
  const afterById = new Map(b.result.lines.map((l) => [l.id, l]));
  for (const [id, before] of beforeById) {
    const after = afterById.get(id);
    if (!after)
      lines.push({ label: before.label, change: 'removed', before: before.amount, after: 0 });
    else if (after.amount !== before.amount)
      lines.push({
        label: after.label,
        change: 'changed',
        before: before.amount,
        after: after.amount,
      });
  }
  for (const [id, after] of afterById)
    if (!beforeById.has(id))
      lines.push({ label: after.label, change: 'added', before: 0, after: after.amount });
  const pick = (label: string, key: keyof EstimateResult) => {
    const before = a.result[key] as number;
    const after = b.result[key] as number;
    return { label, before, after, delta: after - before };
  };
  const fields = (
    [
      ['有効期限', a.input.validUntil, b.input.validUntil],
      ['期間（か月）', String(a.input.months), String(b.input.months)],
      [
        '金額の確定',
        a.result.provisional ? '未確定を含む' : '確定',
        b.result.provisional ? '未確定を含む' : '確定',
      ],
    ] as const
  )
    .filter(([, before, after]) => before !== after)
    .map(([label, before, after]) => ({ label, before, after }));
  return {
    from: a.version,
    to: b.version,
    lines,
    totals: [
      pick('初期費用（税別）', 'initialSubtotal'),
      pick('初期費用（税込）', 'initialTotal'),
      pick('毎月の継続支援（税別）', 'monthlySubtotal'),
      pick('期間の総額（税別）', 'periodSubtotal'),
      pick('期間の総額（税込）', 'periodTotal'),
    ],
    fields,
  };
}
