import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { invoiceDocument } from '../../tools/ops/billing/document';
import {
  type BillingFile,
  type BillingProfile,
  type IssueRequest,
  issueInvoice,
  nextInvoiceId,
  paymentState,
  receivables,
  recordPayment,
  voidInvoice,
} from '../../tools/ops/billing/model';
import {
  type CustomerFile,
  addConsultation,
  addProject,
  advanceProject,
  completeChecklistItem,
  createCustomer,
  customerPath,
  linkEstimate,
  recordApproval,
  recordContract,
} from '../../tools/ops/crm/model';
import {
  type EstimateFile,
  appendVersion,
  estimateInputSchema,
} from '../../tools/ops/estimate/model';
import { renderHtml, renderMarkdown } from '../../tools/ops/shared/document';
import { siteIssuer } from '../../tools/ops/shared/issuer';
import { writeJson } from '../../tools/ops/shared/store';
import { LEGAL_NAME } from '@/content/config';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../tools/ops/fixtures/${name}`, import.meta.url), 'utf8'));
const base = estimateInputSchema.parse(fixture('estimate-basic.json'));
const saved = { savedAt: '2026-09-16T10:00:00+09:00', today: '2026-09-16' };
// 第1版は目安額の撮影を含む。第2版は確定額だけ。
const estimates: EstimateFile = appendVersion(
  appendVersion(null, base, saved),
  estimateInputSchema.parse({ ...base, options: [{ key: 'page_add', quantity: 1 }] }),
  saved,
);
const profile: BillingProfile = fixture('billing-profile.json');
const m = { at: '2026-09-16T10:00:00+09:00', by: 'サンプル担当' };

/** 指定の状態まで、各段階の前提を満たして進めた架空の顧客。 */
function customerAt(stop: 'estimate_sent' | 'contracted' | 'in_production' | 'accepted') {
  let f: CustomerFile = addProject(
    addConsultation(
      createCustomer({ customerId: 'sample-shop', name: '架空の商店', owner: 'サンプル担当' }, m),
      { channel: '電話', summary: '相談（サンプル）' },
      m,
    ),
    { id: 'site-2026', title: 'サイト制作（サンプル）' },
    m,
  );
  for (const v of estimates.versions) f = linkEstimate(f, 'site-2026', v, m);
  f = advanceProject(f, 'site-2026', 'estimate_sent', m);
  if (stop === 'estimate_sent') return f;
  f = recordContract(
    f,
    'site-2026',
    { version: 1, status: 'signed', ref: 'sample-contract', signedOn: '2026-09-17' },
    m,
  );
  f = advanceProject(f, 'site-2026', 'contracted', m);
  if (stop === 'contracted') return f;
  f = advanceProject(f, 'site-2026', 'in_production', m);
  if (stop === 'in_production') return f;
  const decided = { decidedBy: 'サンプル顧客', decidedOn: '2026-09-20' };
  f = recordApproval(
    f,
    'site-2026',
    { id: 'copy', kind: 'copy', item: '原稿', status: 'approved', ...decided },
    m,
  );
  f = recordApproval(
    f,
    'site-2026',
    { id: 'photo', kind: 'photo', item: '写真', status: 'approved', ...decided },
    m,
  );
  f = advanceProject(f, 'site-2026', 'awaiting_acceptance', m);
  for (const key of ['verify-fail-zero', 'domain-customer-name', 'no-secrets-in-source'])
    f = completeChecklistItem(
      f,
      'site-2026',
      { key, doneOn: '2026-09-25', by: 'サンプル担当', evidence: `根拠 ${key}` },
      m,
    );
  return advanceProject(f, 'site-2026', 'accepted', m);
}

const request = (customer: CustomerFile, over: Partial<IssueRequest> = {}): IssueRequest => ({
  customer,
  estimates,
  profile,
  issuer: siteIssuer(),
  existingIds: [],
  projectId: 'site-2026',
  estimateVersion: 2,
  kind: 'deposit',
  issuedOn: '2026-09-18',
  dueOn: '2026-09-30',
  today: '2026-09-18',
  ...m,
  ...over,
});
const ids = (file: BillingFile | null) => file?.invoices.map((i) => i.invoiceId) ?? [];
const planned = estimates.versions[1]!.result.invoices;

describe('請求書の発行', () => {
  it('契約前は止め、契約後は見積の版の金額で着手時の請求を発行する', () => {
    expect(() => issueInvoice(null, request(customerAt('estimate_sent')))).toThrow(
      '締結済みの契約',
    );
    const file = issueInvoice(null, request(customerAt('contracted')));
    const invoice = file.invoices[0]!;
    expect(invoice.invoiceId).toBe('inv-202609-001');
    expect([invoice.subtotal, invoice.tax, invoice.total]).toEqual([
      planned[0]!.subtotal,
      planned[0]!.tax,
      planned[0]!.total,
    ]);
    expect(invoice.issuer.legalName).toBe(LEGAL_NAME);
    expect(invoice.customerLabel).toBe(base.customerLabel);
  });

  it('検収時の請求は検収済みになってからで、着手時と同じ見積の版に限る', () => {
    const inProduction = customerAt('in_production');
    const deposit = issueInvoice(null, request(inProduction));
    expect(() =>
      issueInvoice(
        deposit,
        request(inProduction, { kind: 'acceptance', existingIds: ids(deposit) }),
      ),
    ).toThrow('検収済み');
    const accepted = customerAt('accepted');
    expect(() =>
      issueInvoice(
        deposit,
        request(accepted, { kind: 'acceptance', estimateVersion: 1, existingIds: ids(deposit) }),
      ),
    ).toThrow('同じ見積の版');
    const both = issueInvoice(
      deposit,
      request(accepted, { kind: 'acceptance', existingIds: ids(deposit) }),
    );
    expect(both.invoices.map((i) => i.invoiceId)).toEqual(['inv-202609-001', 'inv-202609-002']);
    expect(both.invoices.reduce((a, i) => a + i.subtotal, 0)).toBe(
      estimates.versions[1]!.result.productionSubtotal,
    );
  });

  it('目安の金額・紐付いていない見積・対象外の請求は発行しない', () => {
    const c = customerAt('contracted');
    expect(() => issueInvoice(null, request(c, { kind: 'options', estimateVersion: 1 }))).toThrow(
      '目安の金額',
    );
    expect(issueInvoice(null, request(c, { kind: 'options' })).invoices[0]!.subtotal).toBe(
      estimates.versions[1]!.result.optionsSubtotal,
    );
    expect(() => issueInvoice(null, request(c, { estimateVersion: 3 }))).toThrow(
      '紐付いていません',
    );
    const other = {
      ...estimates,
      versions: estimates.versions.map((v) => ({
        ...v,
        input: { ...v.input, projectId: 'other' },
      })),
    };
    expect(() => issueInvoice(null, request(c, { estimates: other }))).toThrow('一致しません');
    expect(() => issueInvoice(null, request(c, { dueOn: '2026-09-01' }))).toThrow('お支払期限');
    expect(() => issueInvoice(null, request(c, { issuedOn: '2026-09-19' }))).toThrow('今日');
  });

  it('同じ請求の二重発行を止め、取消した番号は欠番のまま再発行する', () => {
    const c = customerAt('contracted');
    const first = issueInvoice(null, request(c));
    expect(() => issueInvoice(first, request(c, { existingIds: ids(first) }))).toThrow('発行済み');
    const voided = voidInvoice(first, 'inv-202609-001', '宛名の誤り', m);
    const again = issueInvoice(voided, request(c, { existingIds: ids(voided) }));
    expect(again.invoices.map((i) => [i.invoiceId, i.status])).toEqual([
      ['inv-202609-001', 'void'],
      ['inv-202609-002', 'issued'],
    ]);
  });

  it('継続支援は対象月ごとに1件だけ発行する', () => {
    const c = customerAt('in_production');
    expect(() => issueInvoice(null, request(c, { kind: 'monthly' }))).toThrow('--period');
    expect(() => issueInvoice(null, request(c, { period: '2026-10' }))).toThrow(
      '継続支援の請求だけ',
    );
    const oct = issueInvoice(null, request(c, { kind: 'monthly', period: '2026-10' }));
    expect(oct.invoices[0]!.label).toContain('2026-10分');
    expect(oct.invoices[0]!.total).toBe(planned.at(-1)!.total);
    expect(() =>
      issueInvoice(oct, request(c, { kind: 'monthly', period: '2026-10', existingIds: ids(oct) })),
    ).toThrow('発行済み');
    expect(
      issueInvoice(oct, request(c, { kind: 'monthly', period: '2026-11', existingIds: ids(oct) }))
        .invoices,
    ).toHaveLength(2);
  });

  it('請求番号は全顧客・月ごとの通し番号', () => {
    expect(nextInvoiceId([], '2026-09-18')).toBe('inv-202609-001');
    expect(
      nextInvoiceId(['inv-202609-001', 'inv-202609-007', 'inv-202608-020'], '2026-09-30'),
    ).toBe('inv-202609-008');
    expect(nextInvoiceId(['inv-202609-003'], '2026-10-01')).toBe('inv-202610-001');
  });
});

describe('入金と未回収', () => {
  const issued = issueInvoice(null, request(customerAt('contracted')));
  const total = issued.invoices[0]!.total;
  const pay = (file: BillingFile, amount: number, today = '2026-09-25') =>
    recordPayment(
      file,
      'inv-202609-001',
      { receivedOn: '2026-09-25', amount, ref: '通帳 9/25' },
      { ...m, today },
    );

  it('一部入金・完了・期限超過を区別し、残額を超える入金は記録しない', () => {
    expect(paymentState(issued.invoices[0]!, '2026-09-30').state).toBe('unpaid');
    expect(paymentState(issued.invoices[0]!, '2026-10-01').state).toBe('overdue');
    const part = pay(issued, 10000);
    expect(paymentState(part.invoices[0]!, '2026-09-26')).toMatchObject({
      state: 'partial',
      remaining: total - 10000,
    });
    expect(() => pay(part, total)).toThrow('残額');
    expect(() => pay(issued, 1, '2026-09-24')).toThrow('今日');
    const done = pay(part, total - 10000);
    expect(paymentState(done.invoices[0]!, '2026-12-01')).toMatchObject({
      state: 'paid',
      remaining: 0,
    });
    expect(() => voidInvoice(done, 'inv-202609-001', '誤り', m)).toThrow('入金の記録');
  });

  it('未回収を期限順に集め、取消と入金済みを除く', () => {
    const other: BillingFile = {
      ...issueInvoice(
        null,
        request(customerAt('contracted'), { dueOn: '2026-09-20', existingIds: ['inv-202609-001'] }),
      ),
      customerId: 'sample-shop',
    };
    const rows = receivables([issued, other, pay(issued, total)], '2026-09-21');
    expect(rows.map((r) => [r.invoice.invoiceId, r.state])).toEqual([
      ['inv-202609-002', 'overdue'],
      ['inv-202609-001', 'unpaid'],
    ]);
  });
});

describe('請求書の書面', () => {
  const invoice = issueInvoice(null, request(customerAt('contracted'))).invoices[0]!;

  it('未登録では登録番号を載せず、適格請求書ではないと明記する', () => {
    const md = renderMarkdown(invoiceDocument(invoice));
    expect(md).toContain('本書は適格請求書ではありません');
    expect(md).not.toContain('登録番号');
    expect(md).toContain(`${base.customerLabel} 様`);
    expect(md).toContain(LEGAL_NAME);
    expect(md).toContain('架空銀行 サンプル支店');
    expect(md).toContain('inv-202609-001');
  });

  it('登録済みでは登録番号と税率ごとの消費税を載せる', () => {
    const md = renderMarkdown(
      invoiceDocument({
        ...invoice,
        invoiceRegistration: { status: 'registered', number: 'T1234567890123' },
      }),
    );
    expect(md).toContain('| 登録番号 | T1234567890123 |');
    expect(md).toContain('| 10% |');
    expect(md).not.toContain('適格請求書ではありません');
  });

  it('HTML は JavaScript を含まず、取消済みは書面にしない', () => {
    const html = renderHtml(invoiceDocument(invoice));
    expect(html).not.toMatch(/<script|\son[a-z]+=/i);
    expect(() =>
      invoiceDocument({ ...invoice, status: 'void', voided: { ...m, reason: 'x' } }),
    ).toThrow('取消済み');
  });
});

describe('ops:invoice CLI', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const run = (data: string, ...args: string[]) =>
    spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'tools/ops/billing/cli.ts',
        ...args,
        '--data',
        data,
        '--today',
        '2026-09-18',
      ],
      { encoding: 'utf8' },
    );

  it('設定がなければ止め、発行・入金・未回収・書面を実ファイルで扱う', () => {
    const data = mkdtempSync(join(tmpdir(), 'billing-cli-'));
    dirs.push(data);
    writeJson(customerPath(data, 'sample-shop'), customerAt('contracted'));
    writeJson(join(data, 'estimates', 'est-sample-001.json'), estimates);
    const issue = [
      'issue',
      '--customer',
      'sample-shop',
      '--project',
      'site-2026',
      '--estimate',
      'est-sample-001',
      '--version',
      '2',
      '--kind',
      'deposit',
      '--issued-on',
      '2026-09-18',
      '--due',
      '2026-09-30',
      '--by',
      'サンプル担当',
    ];
    const missing = run(data, ...issue);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('profile.json');
    expect(existsSync(join(data, 'billing', 'invoices'))).toBe(false);

    mkdirSync(join(data, 'billing'), { recursive: true });
    writeFileSync(join(data, 'billing', 'profile.json'), JSON.stringify(profile));
    const ok = run(data, ...issue);
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain('inv-202609-001');
    const before = readFileSync(join(data, 'billing', 'invoices', 'sample-shop.json'), 'utf8');
    expect(run(data, ...issue).status).toBe(1);
    expect(readFileSync(join(data, 'billing', 'invoices', 'sample-shop.json'), 'utf8')).toBe(
      before,
    );

    const total = JSON.parse(before).invoices[0].total as number;
    const pay = run(
      data,
      'pay',
      '--customer',
      'sample-shop',
      '--invoice',
      'inv-202609-001',
      '--amount',
      '1000',
      '--received-on',
      '2026-09-18',
      '--ref',
      '通帳',
      '--by',
      'サンプル担当',
    );
    expect(pay.status, pay.stderr).toBe(0);
    expect(pay.stdout).toContain('一部入金');
    const recv = run(data, 'receivables');
    expect(recv.status).toBe(0);
    expect(recv.stdout).toContain(`残額 ${(total - 1000).toLocaleString('en-US')}円`);

    const render = run(
      data,
      'render',
      '--customer',
      'sample-shop',
      '--invoice',
      'inv-202609-001',
      '--format',
      'html',
    );
    expect(render.status, render.stderr).toBe(0);
    const html = readFileSync(join(data, 'billing', 'documents', 'inv-202609-001.html'), 'utf8');
    expect(html).toContain('本書は適格請求書ではありません');
  });
});
