/** npm run ops:invoice -- <command>。使い方は tools/ops/README.md。 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadCustomer } from '../crm/model';
import { estimateFileSchema } from '../estimate/model';
import { type Args, runCli } from '../shared/cli';
import { renderHtml, renderMarkdown, yen } from '../shared/document';
import { siteIssuer } from '../shared/issuer';
import {
  OpsError,
  parseId,
  readJson,
  readJsonIfExists,
  resolveDataDir,
  resolveOutputFile,
  writeJson,
  writeText,
} from '../shared/store';
import { now, parseDate, parseMonth, today } from '../shared/time';
import { invoiceDocument } from './document';
import {
  type BillingFile,
  type InvoiceKind,
  KIND_LABELS,
  PAYMENT_STATE_LABELS,
  billingFileSchema,
  issueInvoice,
  paymentState,
  profileSchema,
  receivables,
  recordPayment,
  voidInvoice,
} from './model';

const USAGE = `
npm run ops:invoice -- profile
npm run ops:invoice -- issue   --customer <顧客ID> --project <案件ID> --estimate <見積番号> --version <版> --kind deposit|acceptance|options|monthly [--period YYYY-MM] --issued-on YYYY-MM-DD --due YYYY-MM-DD --by <担当者>
npm run ops:invoice -- pay     --customer <顧客ID> --invoice <請求番号> --amount <円> --received-on YYYY-MM-DD --ref <入金の根拠> --by <担当者>
npm run ops:invoice -- void    --customer <顧客ID> --invoice <請求番号> --reason <理由> --by <担当者>
npm run ops:invoice -- list    --customer <顧客ID>
npm run ops:invoice -- receivables
npm run ops:invoice -- render  --customer <顧客ID> --invoice <請求番号> --format md|html [--out <ファイル>]
共通: [--data <データの置き場所>] [--today YYYY-MM-DD]
`;

const KINDS: readonly InvoiceKind[] = ['deposit', 'acceptance', 'options', 'monthly'];

const dataOf = (args: Args) => resolveDataDir(args.optional('data'));
const todayOf = (args: Args) => parseDate(args.optional('today') ?? today(), '--today');
const invoicesDir = (data: string) => join(data, 'billing', 'invoices');
const billingPath = (data: string, customerId: string) =>
  join(invoicesDir(data), `${parseId(customerId, '--customer')}.json`);
const profilePath = (data: string) => join(data, 'billing', 'profile.json');

function loadProfile(data: string) {
  const path = profilePath(data);
  if (!existsSync(path))
    throw new OpsError(
      `${path} がありません。振込先とインボイス登録の状況を記録してから請求します（例: tools/ops/fixtures/billing-profile.json）`,
    );
  return readJson(path, profileSchema);
}

function loadBilling(data: string, customerId: string): BillingFile | null {
  const path = billingPath(data, customerId);
  const file = readJsonIfExists(path, billingFileSchema);
  if (file && file.customerId !== customerId)
    throw new OpsError(`${path}: 顧客 ID が一致しません。他の顧客のデータを混ぜません`);
  return file;
}

function allBilling(data: string): BillingFile[] {
  const dir = invoicesDir(data);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const file = readJson(join(dir, name), billingFileSchema);
      if (`${file.customerId}.json` !== name)
        throw new OpsError(`${join(dir, name)}: ファイル名と顧客 ID が一致しません`);
      return file;
    });
}

const required = (data: string, customerId: string) => {
  const file = loadBilling(data, customerId);
  if (!file) throw new OpsError(`${customerId} の請求の記録がありません`);
  return file;
};

runCli(USAGE, {
  profile(args) {
    const profile = loadProfile(dataOf(args));
    const issuer = siteIssuer();
    console.log(`発行者\t${issuer.brand}（${issuer.legalName}）`);
    console.log(`所在地\t${issuer.address}`);
    console.log(
      `インボイス\t${profile.invoiceRegistration.status === 'registered' ? `登録済み ${profile.invoiceRegistration.number}` : '未登録（登録番号を記載しない）'}`,
    );
    const b = profile.bankTransfer;
    console.log(
      `振込先\t${b.bank} ${b.branch} ${b.accountType} ${b.accountNumber} ${b.accountHolder}`,
    );
  },
  issue(args) {
    const data = dataOf(args);
    const customerId = parseId(args.required('customer'), '--customer');
    const customer = loadCustomer(data, customerId);
    if (!customer)
      throw new OpsError(`顧客がありません: ${customerId}（ops:crm init で登録します）`);
    const estimateId = parseId(args.required('estimate'), '--estimate');
    const estimates = readJson(join(data, 'estimates', `${estimateId}.json`), estimateFileSchema);
    const kind = args.required('kind') as InvoiceKind;
    if (!KINDS.includes(kind)) throw new OpsError(`--kind は ${KINDS.join('|')}`);
    const period = args.optional('period');
    const next = issueInvoice(loadBilling(data, customerId), {
      customer,
      estimates,
      profile: loadProfile(data),
      issuer: siteIssuer(),
      existingIds: allBilling(data).flatMap((f) => f.invoices.map((i) => i.invoiceId)),
      projectId: parseId(args.required('project'), '--project'),
      estimateVersion: args.integer('version'),
      kind,
      ...(period ? { period: parseMonth(period, '--period') } : {}),
      issuedOn: parseDate(args.required('issued-on'), '--issued-on'),
      dueOn: parseDate(args.required('due'), '--due'),
      today: todayOf(args),
      at: now(),
      by: args.required('by'),
    });
    writeJson(billingPath(data, customerId), next);
    const issued = next.invoices.at(-1)!;
    console.log(
      `${issued.invoiceId} を発行しました（${KIND_LABELS[issued.kind]} 税込 ${yen(issued.total)}、期限 ${issued.dueOn}）`,
    );
  },
  pay(args) {
    const data = dataOf(args);
    const customerId = args.required('customer');
    const invoiceId = parseId(args.required('invoice'), '--invoice');
    const next = recordPayment(
      required(data, customerId),
      invoiceId,
      {
        receivedOn: parseDate(args.required('received-on'), '--received-on'),
        amount: args.integer('amount'),
        ref: args.required('ref'),
      },
      { at: now(), by: args.required('by'), today: todayOf(args) },
    );
    writeJson(billingPath(data, customerId), next);
    const invoice = next.invoices.find((i) => i.invoiceId === invoiceId)!;
    const { remaining, state } = paymentState(invoice, todayOf(args));
    console.log(`${invoiceId}: ${PAYMENT_STATE_LABELS[state]}（残額 ${yen(remaining)}）`);
  },
  void(args) {
    const data = dataOf(args);
    const customerId = args.required('customer');
    const invoiceId = parseId(args.required('invoice'), '--invoice');
    const next = voidInvoice(required(data, customerId), invoiceId, args.required('reason'), {
      at: now(),
      by: args.required('by'),
    });
    writeJson(billingPath(data, customerId), next);
    console.log(`${invoiceId} を取消しました（番号は欠番として残します）`);
  },
  list(args) {
    const t = todayOf(args);
    for (const invoice of required(dataOf(args), args.required('customer')).invoices) {
      const { paid, remaining, state } = paymentState(invoice, t);
      console.log(
        [
          invoice.invoiceId,
          invoice.projectId,
          invoice.label,
          `税込 ${yen(invoice.total)}`,
          `入金 ${yen(paid)}`,
          `残額 ${yen(remaining)}`,
          `期限 ${invoice.dueOn}`,
          PAYMENT_STATE_LABELS[state],
        ].join('\t'),
      );
    }
  },
  receivables(args) {
    const t = todayOf(args);
    const rows = receivables(allBilling(dataOf(args)), t);
    for (const r of rows)
      console.log(
        [
          r.customerId,
          r.invoice.invoiceId,
          r.invoice.label,
          `残額 ${yen(r.remaining)}`,
          `期限 ${r.invoice.dueOn}`,
          PAYMENT_STATE_LABELS[r.state],
        ].join('\t'),
      );
    const overdue = rows.filter((r) => r.state === 'overdue');
    console.log(
      `未回収 ${rows.length}件・${yen(rows.reduce((a, r) => a + r.remaining, 0))}（うち期限超過 ${overdue.length}件）`,
    );
    if (overdue.length) process.exitCode = 1;
  },
  render(args) {
    const data = dataOf(args);
    const customerId = args.required('customer');
    const invoiceId = parseId(args.required('invoice'), '--invoice');
    const format = args.required('format');
    if (format !== 'md' && format !== 'html') throw new OpsError('--format は md か html');
    const invoice = required(data, customerId).invoices.find((i) => i.invoiceId === invoiceId);
    if (!invoice) throw new OpsError(`請求書がありません: ${invoiceId}`);
    const doc = invoiceDocument(invoice);
    const out = resolveOutputFile(
      args.optional('out') ?? join(data, 'billing', 'documents', `${invoiceId}.${format}`),
    );
    writeText(out, format === 'md' ? renderMarkdown(doc) : renderHtml(doc));
    console.log(`${out} を書き出しました`);
  },
});
