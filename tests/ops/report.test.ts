import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderHtml, renderMarkdown } from '../../tools/ops/shared/document';
import { sha256 } from '../../tools/ops/shared/cli';
import { createImport, sourcesFileSchema, summarizeMonth } from '../../tools/ops/metrics/model';
import {
  addRequest,
  logWork,
  moveRequest,
  type RequestsFile,
} from '../../tools/ops/requests/model';
import {
  type GbpPerformance,
  type ReportInput,
  approvalStatus,
  buildMonthlyReport,
  gbpPerformanceSchema,
} from '../../tools/ops/report/model';

const sources = sourcesFileSchema.parse(
  JSON.parse(
    readFileSync(new URL('../../tools/ops/fixtures/metrics/sources.json', import.meta.url), 'utf8'),
  ),
);
const at = '2026-09-01T00:00:00.000Z';
const header = 'occurred_at,metric,channel,ref\n';
// 8 月は問い合わせ 0 件（記録あり）、7 月は計測期間外。
const augustInquiries = createImport({
  sources,
  existing: [],
  sourceId: 'inquiry-intake',
  fileName: 'aug.csv',
  text: header,
  sha256: 'a'.repeat(64),
  period: { from: '2026-08-01', to: '2026-08-31' },
  importedAt: at,
});
const septemberInquiries = createImport({
  sources,
  existing: [augustInquiries],
  sourceId: 'inquiry-intake',
  fileName: 'sep.csv',
  text: `${header}2026-09-02T10:00:00+09:00,inquiries,form,s-1\n2026-09-03T10:00:00+09:00,inquiries,phone,s-2\n`,
  sha256: 'b'.repeat(64),
  period: { from: '2026-09-01', to: '2026-09-30' },
  importedAt: at,
});
const imports = [augustInquiries, septemberInquiries];

const requests = (): RequestsFile => {
  const empty: RequestsFile = {
    customerId: 'sample-shop',
    trackingSince: '2026-07-01',
    requests: [],
  };
  const request = {
    receivedAt: '2026-09-01T09:00:00+09:00',
    channel: 'サンプル',
    url: 'https://example.jp/',
    location: { note: 'トップの電話番号の下' },
    description: '営業時間の表記を直す（サンプル）',
    by: 'サンプル担当',
  };
  const first = addRequest(empty, {
    ...request,
    receivedAt: '2026-08-20T09:00:00+09:00',
    dueOn: '2026-09-05',
  });
  let f = moveRequest(first.file, first.id, 'in_progress', { at: request.receivedAt, by: 'x' });
  f = logWork(f, first.id, { date: '2026-08-31', minutes: 50, by: 'x' });
  f = logWork(f, first.id, { date: '2026-09-01', minutes: 22, by: 'x' });
  const second = addRequest(f, { ...request, description: '写真を差し替える（サンプル）' });
  f = moveRequest(second.file, second.id, 'in_progress', { at: request.receivedAt, by: 'x' });
  return logWork(f, second.id, { date: '2026-09-02', minutes: 11, by: 'x' });
};

const gbp = (
  month: string,
  items: GbpPerformance['items'],
  customerId = 'sample-shop',
): GbpPerformance =>
  gbpPerformanceSchema.parse({
    customerId,
    month,
    source: 'GBP 管理画面の実績を転記（サンプル）',
    enteredBy: 'サンプル担当',
    enteredOn: '2026-10-01',
    items,
  });

const input = (overrides: Partial<ReportInput> = {}): ReportInput => ({
  customerId: 'sample-shop',
  customerLabel: '架空の商店',
  month: '2026-09',
  generatedAt: '2026-10-01T09:00:00+09:00',
  today: '2026-10-01',
  metrics: summarizeMonth('sample-shop', '2026-09', sources, imports),
  previousMetrics: summarizeMonth('sample-shop', '2026-08', sources, imports),
  requests: requests(),
  gbp: gbp('2026-09', [
    { label: 'サンプル項目 A', value: 12 },
    { label: 'サンプル項目 B', value: null },
  ]),
  previousGbp: gbp('2026-08', [{ label: 'サンプル項目 A', value: 0 }]),
  plan: 'run_basic',
  notes: [],
  ...overrides,
});
const row = (md: string, label: string) => md.split('\n').find((l) => l.startsWith(`| ${label} |`));

describe('0 件と未計測を取り違えない', () => {
  it('前月 0 件（計測あり）は 0 件、予約（データ源なし）は未計測として出す', () => {
    const md = renderMarkdown(buildMonthlyReport(input()).document);
    expect(row(md, '問い合わせ')).toBe('| 問い合わせ | 2件 | 0件 | 前月比 +2件 |');
    expect(row(md, '予約')).toContain('未計測');
    expect(row(md, '予約')).not.toContain('0件');
    expect(md).toContain('どちらも 0 件ではありません');
  });

  it('GBP の未入力は 0 と区別し、前月に項目がなければ未計測。前月 0 との比較は出す', () => {
    const md = renderMarkdown(buildMonthlyReport(input()).document);
    expect(row(md, 'サンプル項目 A')).toBe('| サンプル項目 A | 12 | 0 | 前月比 +12 |');
    expect(row(md, 'サンプル項目 B')).toBe('| サンプル項目 B | 未入力 | 未計測 | 比較できません |');
  });

  it('GBP の実績や依頼の記録がなければ、0 ではなく未計測・未記録と書く', () => {
    const { document, actions } = buildMonthlyReport(
      input({ gbp: null, previousGbp: null, requests: null }),
    );
    const md = renderMarkdown(document);
    expect(md).toContain('今月の実績は入力されていません（未計測）');
    expect(md).toContain('修正依頼の記録がありません（未記録）');
    expect(actions).toContain('GBP の今月の実績が未入力');
  });
});

describe('二重計上をしない', () => {
  it('作業時間は対象月の記録だけを月合計で 5 分切り上げ、前月分を足さない', () => {
    const md = renderMarkdown(buildMonthlyReport(input()).document);
    expect(md).toContain('今月の作業時間：33分（月の合計を 5 分単位で切り上げて 35分）');
    expect(md).toContain('| req-0001 | 営業時間の表記を直す（サンプル） | 着手 | 22分 |');
    // 7 月 0 分・8 月 50 分・9 月 35 分（すべて月初から記録）
    expect(md).toContain('3 か月平均：28.3分');
  });

  it('変更枠を超えたら対応事項に出す（枠は公開料金の分数）', () => {
    const { actions } = buildMonthlyReport(input({ plan: 'run_basic' }));
    expect(actions.some((a) => a.includes('変更枠 30分 を超えています'))).toBe(true);
    expect(
      buildMonthlyReport(input({ plan: 'run_standard' })).actions.some((a) => a.includes('変更枠')),
    ).toBe(false);
  });
});

describe('顧客・月の混在を止める', () => {
  it('他の顧客の依頼・GBP の実績を拒否する', () => {
    expect(() =>
      buildMonthlyReport(input({ requests: { ...requests(), customerId: 'other-shop' } })),
    ).toThrow('顧客 ID');
    expect(() =>
      buildMonthlyReport(input({ gbp: gbp('2026-09', [{ label: 'A', value: 1 }], 'other-shop') })),
    ).toThrow('顧客 ID');
  });

  it('月の違う GBP の実績・指標を拒否する', () => {
    expect(() =>
      buildMonthlyReport(input({ gbp: gbp('2026-08', [{ label: 'A', value: 1 }]) })),
    ).toThrow('月が違います');
    expect(() => buildMonthlyReport(input({ previousMetrics: input().metrics }))).toThrow(
      '期間が対象月と違います',
    );
  });
});

describe('対応事項と下書き', () => {
  it('欠損・期限超過・手入力の事項を対応事項に集め、下書きであることを明示する', () => {
    const log = createImport({
      sources,
      existing: [],
      sourceId: 'server-log',
      fileName: 'partial.csv',
      text: 'date,metric,dimension,value\n2026-09-01,page_views,,5\n',
      sha256: 'c'.repeat(64),
      period: { from: '2026-09-01', to: '2026-09-01' },
      importedAt: at,
    });
    const { document, actions } = buildMonthlyReport(
      input({
        metrics: summarizeMonth('sample-shop', '2026-09', sources, [...imports, log]),
        notes: ['サンプルの確認事項'],
      }),
    );
    expect(actions.some((a) => a.startsWith('閲覧数：29 日分のデータがありません'))).toBe(true);
    expect(actions.some((a) => a.includes('req-0001') && a.includes('期限超過'))).toBe(true);
    expect(actions).toContain('サンプルの確認事項');
    const html = renderHtml(document);
    expect(document.title).toBe('月次レポート 2026-09（下書き）');
    expect(html).toContain('確認前の下書きです');
    expect(html).not.toMatch(/<script/i);
  });

  it('確認後に下書きが変われば、確認は無効になる', () => {
    const approval = {
      customerId: 'sample-shop',
      month: '2026-09',
      draftFile: 'x.md',
      draftSha256: sha256('draft-1'),
      approvedBy: 'サンプル確認者',
      approvedAt: at,
    };
    expect(approvalStatus('draft-1', null)).toBe('unapproved');
    expect(approvalStatus('draft-1', approval)).toBe('approved');
    expect(approvalStatus('draft-2', approval)).toBe('stale');
  });
});
