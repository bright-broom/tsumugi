/**
 * 請求書と入金の記録（監査 D05、ADR 0078）。
 * 金額は保存済みの見積の版からだけ取り、手入力を受け付けない。発行の時期は契約（着手時50%・検収時50%）と
 * 案件の状態で止める。発行者・振込先は発行時の値を請求書に写し、後から設定を変えても書面が変わらない。
 * 送信・決済・会計サービスとの連携はしない。
 */
import { z } from 'zod';
import type { CustomerFile } from '../crm/model';
import type { EstimateFile, EstimateVersion } from '../estimate/model';
import type { Issuer } from '../shared/issuer';
import { OpsError, idSchema } from '../shared/store';
import { dateSchema, monthSchema, timestampSchema } from '../shared/time';

const text = z.string().trim().min(1);

// ── 発行者の設定（.data/billing/profile.json、git 管理外）─────────────

const registrationSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('unregistered') }),
  z.strictObject({
    status: z.literal('registered'),
    number: z.string().regex(/^T\d{13}$/, '登録番号は T と13桁の数字'),
  }),
]);

const bankSchema = z.strictObject({
  bank: text,
  branch: text,
  accountType: z.enum(['普通', '当座']),
  accountNumber: z.string().regex(/^\d{7}$/, '口座番号は7桁の数字'),
  accountHolder: text,
});

export const profileSchema = z.strictObject({
  invoiceRegistration: registrationSchema,
  bankTransfer: bankSchema,
});
export type BillingProfile = z.infer<typeof profileSchema>;

// ── 請求書 ─────────────────────────────────────────

const KINDS = ['deposit', 'acceptance', 'options', 'monthly'] as const;
export type InvoiceKind = (typeof KINDS)[number];
export const KIND_LABELS: Record<InvoiceKind, string> = {
  deposit: '着手時（制作本体の50%）',
  acceptance: '検収時（制作本体の50%）',
  options: '追加オプション',
  monthly: '継続支援',
};

const meta = z.strictObject({ at: timestampSchema, by: text });

const paymentSchema = z.strictObject({
  receivedOn: dateSchema,
  amount: z.int().min(1),
  /** 通帳・振込明細など、入金を確かめた根拠。 */
  ref: text,
  recordedAt: timestampSchema,
  by: text,
});

const invoiceSchema = z
  .strictObject({
    invoiceId: idSchema,
    projectId: idSchema,
    estimateId: idSchema,
    estimateVersion: z.int().min(1),
    kind: z.enum(KINDS),
    /** 継続支援の対象月。 */
    period: monthSchema.optional(),
    customerLabel: text,
    label: text,
    subtotal: z.int().min(1),
    tax: z.int().min(0),
    total: z.int().min(1),
    issuedOn: dateSchema,
    dueOn: dateSchema,
    issued: meta,
    issuer: z.strictObject({
      brand: text,
      legalName: text,
      address: text,
      tel: text,
      email: text,
    }),
    invoiceRegistration: registrationSchema,
    bankTransfer: bankSchema,
    status: z.enum(['issued', 'void']),
    voided: meta.extend({ reason: text }).optional(),
    payments: z.array(paymentSchema),
  })
  .refine((i) => (i.kind === 'monthly') === (i.period !== undefined), {
    message: '対象月は継続支援の請求だけに記録します',
    path: ['period'],
  })
  .refine((i) => i.dueOn >= i.issuedOn, {
    message: 'お支払期限が請求日より前です',
    path: ['dueOn'],
  })
  .refine((i) => i.subtotal + i.tax === i.total, {
    message: '税別と消費税の合計が税込額と一致しません',
    path: ['total'],
  })
  .refine((i) => (i.status === 'void') === (i.voided !== undefined), {
    message: '取消の記録は取消した請求書だけに持たせます',
    path: ['voided'],
  });
export type Invoice = z.infer<typeof invoiceSchema>;

export const billingFileSchema = z.strictObject({
  customerId: idSchema,
  invoices: z.array(invoiceSchema),
});
export type BillingFile = z.infer<typeof billingFileSchema>;

/** 請求番号は全顧客で通し番号にする（inv-YYYYMM-001）。 */
export function nextInvoiceId(existing: readonly string[], issuedOn: string): string {
  const prefix = `inv-${issuedOn.slice(0, 4)}${issuedOn.slice(5, 7)}-`;
  const used = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter(Number.isInteger);
  const next = Math.max(0, ...used) + 1;
  if (next > 999) throw new OpsError(`${prefix} の請求番号が 999 件を超えました`);
  return `${prefix}${String(next).padStart(3, '0')}`;
}

/** 保存済みの見積の版から、支払いの回ごとの金額を取り出す（calculateEstimate と同じ並び）。 */
function installments(version: EstimateVersion) {
  const { input, result } = version;
  const list = [...result.invoices];
  const monthly = list.pop()!;
  const deposit = input.production !== null ? list.shift() : undefined;
  const acceptance = input.production !== null ? list.shift() : undefined;
  const options = list.shift();
  return { deposit, acceptance, options, monthly } satisfies Record<
    InvoiceKind,
    (typeof list)[number] | undefined
  >;
}

const ACTIVE_STATES = [
  'contracted',
  'in_production',
  'awaiting_acceptance',
  'accepted',
  'handed_over',
] as const;
const ACCEPTED_STATES = ['accepted', 'handed_over'] as const;

export interface IssueRequest {
  customer: CustomerFile;
  estimates: EstimateFile;
  profile: BillingProfile;
  issuer: Issuer;
  /** 全顧客の既存の請求番号。通し番号の採番に使う。 */
  existingIds: readonly string[];
  projectId: string;
  estimateVersion: number;
  kind: InvoiceKind;
  period?: string;
  issuedOn: string;
  dueOn: string;
  today: string;
  at: string;
  by: string;
}

/** 請求書を1件発行する。前提を満たさないものは保存しない。 */
export function issueInvoice(file: BillingFile | null, req: IssueRequest): BillingFile {
  const { customer, estimates } = req;
  if (file && file.customerId !== customer.customerId)
    throw new OpsError('請求の記録と顧客 ID が一致しません。他の顧客のデータを混ぜません');
  const project = customer.projects.find((p) => p.id === req.projectId);
  if (!project) throw new OpsError(`案件がありません: ${req.projectId}`);
  if (req.issuedOn > req.today)
    throw new OpsError(`請求日（${req.issuedOn}）が今日（${req.today}）より後です`);
  if (req.dueOn < req.issuedOn)
    throw new OpsError(`お支払期限（${req.dueOn}）が請求日（${req.issuedOn}）より前です`);

  const linked = project.estimates.some(
    (e) => e.estimateId === estimates.estimateId && e.version === req.estimateVersion,
  );
  if (!linked)
    throw new OpsError(
      `${estimates.estimateId} 第${req.estimateVersion}版はこの案件に紐付いていません。ops:crm estimate で紐付けてから請求します`,
    );
  const version = estimates.versions.find((v) => v.version === req.estimateVersion);
  if (!version)
    throw new OpsError(`${estimates.estimateId} に第${req.estimateVersion}版はありません`);
  if (version.input.customerId !== customer.customerId || version.input.projectId !== project.id)
    throw new OpsError('見積の顧客・案件が請求先と一致しません');

  if (!project.contracts.some((c) => c.status === 'signed'))
    throw new OpsError('締結済みの契約がないため、請求書を発行できません');
  if (!(ACTIVE_STATES as readonly string[]).includes(project.state))
    throw new OpsError(`案件の状態（${project.state}）では請求できません。契約済み以降が必要です`);
  if (req.kind === 'acceptance' && !(ACCEPTED_STATES as readonly string[]).includes(project.state))
    throw new OpsError('検収時の請求は、案件が検収済みになってから発行します');
  if ((req.kind === 'monthly') !== (req.period !== undefined))
    throw new OpsError(
      req.kind === 'monthly'
        ? '継続支援の請求には --period YYYY-MM が必要です'
        : '--period は継続支援の請求だけに指定します',
    );

  const amount = installments(version)[req.kind];
  if (!amount) throw new OpsError(`この見積には「${KIND_LABELS[req.kind]}」の請求がありません`);
  if (amount.certainty !== 'fixed')
    throw new OpsError(
      `「${KIND_LABELS[req.kind]}」は目安の金額を含むため請求できません。金額を確定した見積の版を保存してから請求します`,
    );
  if (amount.subtotal === 0)
    throw new OpsError(`「${KIND_LABELS[req.kind]}」は0円のため、請求書を発行しません`);

  const current = (file?.invoices ?? []).filter(
    (i) => i.status === 'issued' && i.projectId === project.id,
  );
  const duplicate = current.find(
    (i) => i.kind === req.kind && (req.kind !== 'monthly' || i.period === req.period),
  );
  if (duplicate)
    throw new OpsError(
      `同じ請求が発行済みです: ${duplicate.invoiceId}。訂正する場合は取消（void）してから発行し直します`,
    );
  // 着手時と検収時で制作本体の額が食い違わないよう、同じ見積の版を使う。
  if (req.kind === 'deposit' || req.kind === 'acceptance') {
    const pair = current.find(
      (i) => i.kind === (req.kind === 'deposit' ? 'acceptance' : 'deposit'),
    );
    if (
      pair &&
      (pair.estimateId !== estimates.estimateId || pair.estimateVersion !== version.version)
    )
      throw new OpsError(
        `${pair.invoiceId} は ${pair.estimateId} 第${pair.estimateVersion}版で発行しています。着手時と検収時は同じ見積の版で請求します（金額の変更は別途精算）`,
      );
  }

  const invoice: Invoice = {
    invoiceId: nextInvoiceId(req.existingIds, req.issuedOn),
    projectId: project.id,
    estimateId: estimates.estimateId,
    estimateVersion: version.version,
    kind: req.kind,
    ...(req.period ? { period: req.period } : {}),
    customerLabel: version.input.customerLabel,
    label: req.period ? `${amount.label}（${req.period}分）` : amount.label,
    subtotal: amount.subtotal,
    tax: amount.tax,
    total: amount.total,
    issuedOn: req.issuedOn,
    dueOn: req.dueOn,
    issued: { at: req.at, by: req.by },
    issuer: { ...req.issuer },
    invoiceRegistration: req.profile.invoiceRegistration,
    bankTransfer: req.profile.bankTransfer,
    status: 'issued',
    payments: [],
  };
  return billingFileSchema.parse({
    customerId: customer.customerId,
    invoices: [...(file?.invoices ?? []), invoice],
  });
}

function findInvoice(file: BillingFile, invoiceId: string): Invoice {
  const invoice = file.invoices.find((i) => i.invoiceId === invoiceId);
  if (!invoice) throw new OpsError(`請求書がありません: ${invoiceId}`);
  return invoice;
}

const replace = (file: BillingFile, next: Invoice): BillingFile =>
  billingFileSchema.parse({
    ...file,
    invoices: file.invoices.map((i) => (i.invoiceId === next.invoiceId ? next : i)),
  });

const paidAmount = (invoice: Invoice) => invoice.payments.reduce((a, p) => a + p.amount, 0);

/** 入金を記録する。残額を超える入金・取消済みへの入金は記録しない（過入金は返金・充当を人が判断する）。 */
export function recordPayment(
  file: BillingFile,
  invoiceId: string,
  payment: { receivedOn: string; amount: number; ref: string },
  m: { at: string; by: string; today: string },
): BillingFile {
  const invoice = findInvoice(file, invoiceId);
  if (invoice.status === 'void') throw new OpsError(`${invoiceId} は取消済みです`);
  if (payment.receivedOn > m.today)
    throw new OpsError(`入金日（${payment.receivedOn}）が今日（${m.today}）より後です`);
  const remaining = invoice.total - paidAmount(invoice);
  if (payment.amount > remaining)
    throw new OpsError(
      `入金額 ${payment.amount}円 が残額 ${remaining}円 を超えています。過入金は記録せず、返金または充当を確認してください`,
    );
  return replace(file, {
    ...invoice,
    payments: [...invoice.payments, { ...payment, recordedAt: m.at, by: m.by }],
  });
}

/** 取消は入金がない請求書だけ。番号は欠番として残す。 */
export function voidInvoice(
  file: BillingFile,
  invoiceId: string,
  reason: string,
  m: { at: string; by: string },
): BillingFile {
  const invoice = findInvoice(file, invoiceId);
  if (invoice.status === 'void') throw new OpsError(`${invoiceId} は取消済みです`);
  if (invoice.payments.length)
    throw new OpsError(
      `${invoiceId} には入金の記録があるため取消できません。返金・精算を確認してください`,
    );
  return replace(file, { ...invoice, status: 'void', voided: { ...m, reason } });
}

export type PaymentState = 'void' | 'paid' | 'partial' | 'unpaid' | 'overdue';
export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  void: '取消',
  paid: '入金済み',
  partial: '一部入金',
  unpaid: '未入金',
  overdue: '期限超過',
};

export function paymentState(invoice: Invoice, today: string) {
  const paid = paidAmount(invoice);
  const remaining = invoice.status === 'void' ? 0 : invoice.total - paid;
  const state: PaymentState =
    invoice.status === 'void'
      ? 'void'
      : remaining === 0
        ? 'paid'
        : today > invoice.dueOn
          ? 'overdue'
          : paid > 0
            ? 'partial'
            : 'unpaid';
  return { paid, remaining, state };
}

/** 全顧客の未回収。期限の近い順。 */
export function receivables(files: readonly BillingFile[], today: string) {
  return files
    .flatMap((f) =>
      f.invoices.map((invoice) => ({
        customerId: f.customerId,
        invoice,
        ...paymentState(invoice, today),
      })),
    )
    .filter((r) => r.remaining > 0)
    .sort((a, b) => a.invoice.dueOn.localeCompare(b.invoice.dueOn));
}
