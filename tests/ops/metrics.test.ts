import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJson } from '../../tools/ops/shared/store';
import {
  type ImportFile,
  type SourcesFile,
  compareMeasurements,
  createImport,
  formatMeasurement,
  loadCustomerMetrics,
  sourcesFileSchema,
  summarizeMonth,
} from '../../tools/ops/metrics/model';

const fixture = (name: string) =>
  readFileSync(new URL(`../../tools/ops/fixtures/metrics/${name}`, import.meta.url), 'utf8');
const sources: SourcesFile = sourcesFileSchema.parse(JSON.parse(fixture('sources.json')));
const AT = '2026-09-01T00:00:00.000Z';

let seq = 0;
const imp = (
  sourceId: string,
  from: string,
  to: string,
  text: string,
  existing: ImportFile[] = [],
) =>
  createImport({
    sources,
    existing,
    sourceId,
    fileName: `${sourceId}-${from}.csv`,
    text,
    sha256: String(++seq).padStart(64, '0'),
    period: { from, to },
    importedAt: AT,
  });

const fullDailyLog = (month: string, days: number, skip: string[] = []) => {
  const rows = ['date,metric,dimension,value'];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (skip.includes(date)) continue;
    rows.push(`${date},page_views,,10`, `${date},visits,,4`, `${date},referrals,search,3`);
  }
  return rows.join('\n');
};
const byMetric = (list: ReturnType<typeof summarizeMonth>, metric: string) =>
  list.find((s) => s.metric === metric)!;

describe('0 件・未計測・欠損を区別する', () => {
  it('記録の期間を網羅していて行がなければ 0 件、データ源がなければ未計測', () => {
    const inquiries = imp(
      'inquiry-intake',
      '2026-08-01',
      '2026-08-31',
      'occurred_at,metric,channel,ref\n',
    );
    const summary = summarizeMonth('sample-shop', '2026-08', sources, [inquiries]);
    const i = byMetric(summary, 'inquiries');
    const b = byMetric(summary, 'bookings');
    expect(i.measurement).toEqual({ status: 'measured', value: 0, breakdown: {} });
    expect(formatMeasurement(i.measurement, i.unit)).toBe('0件');
    expect(b.measurement.status).toBe('not_measured');
    expect(formatMeasurement(b.measurement, b.unit)).toMatch(/^未計測/);
    expect(b.source).toBeNull();
  });

  it('計測開始前の月は未計測、取り込みのない日は欠損（途中までの値を合計にしない）', () => {
    const july = summarizeMonth('sample-shop', '2026-07', sources, []);
    expect(byMetric(july, 'inquiries').measurement).toMatchObject({
      status: 'not_measured',
      reason: 'この月は計測期間外です',
    });
    const half = imp(
      'inquiry-intake',
      '2026-08-01',
      '2026-08-15',
      fixture('inquiries.csv').split('\n').slice(0, 2).join('\n'),
    );
    const m = byMetric(
      summarizeMonth('sample-shop', '2026-08', sources, [half]),
      'inquiries',
    ).measurement;
    expect(m.status).toBe('missing');
    if (m.status !== 'missing') throw new Error('unreachable');
    expect(m.missingDates).toHaveLength(16);
    expect(m.partialValue).toBe(1);
    expect(formatMeasurement(m, '件')).toMatch(/^欠損あり/);
  });

  it('日次集計の行がない日・値が空欄の日は欠損', () => {
    const text = fullDailyLog('2026-08', 31, ['2026-08-15']).replace(
      '2026-08-16,page_views,,10',
      '2026-08-16,page_views,,',
    );
    const summary = summarizeMonth('sample-shop', '2026-08', sources, [
      imp('server-log', '2026-08-01', '2026-08-31', text),
    ]);
    const pv = byMetric(summary, 'page_views').measurement;
    expect(pv).toMatchObject({
      status: 'missing',
      missingDates: ['2026-08-15', '2026-08-16'],
      partialValue: 290,
    });
    expect(byMetric(summary, 'visits').measurement).toMatchObject({
      status: 'missing',
      missingDates: ['2026-08-15'],
    });
  });

  it('全日そろえば計測値と内訳を出し、出所と期間を持つ', () => {
    const summary = summarizeMonth('sample-shop', '2026-08', sources, [
      imp('server-log', '2026-08-01', '2026-08-31', fullDailyLog('2026-08', 31)),
    ]);
    const r = byMetric(summary, 'referrals');
    expect(r.measurement).toEqual({ status: 'measured', value: 93, breakdown: { search: 93 } });
    expect(r.period).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(r.source?.definition).toContain('ボット');
    expect(r.imports[0]?.period).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('時刻は日本時間の暦日に寄せる（UTC 23:30 は翌日）', () => {
    const file = imp('inquiry-intake', '2026-08-01', '2026-08-31', fixture('inquiries.csv'));
    expect(file.events.map((e) => e.date)).toEqual(['2026-08-03', '2026-08-21']);
  });
});

describe('二重計上と取り違えを防ぐ', () => {
  it('同じファイル・重なる期間・重複 ref を取り込まない', () => {
    const first = imp('inquiry-intake', '2026-08-01', '2026-08-31', fixture('inquiries.csv'));
    expect(() =>
      createImport({
        sources,
        existing: [first],
        sourceId: 'inquiry-intake',
        fileName: 'again.csv',
        text: '',
        sha256: first.sha256,
        period: { from: '2026-09-01', to: '2026-09-30' },
        importedAt: AT,
      }),
    ).toThrow('取り込み済み');
    expect(() =>
      imp('inquiry-intake', '2026-08-31', '2026-09-30', 'occurred_at,metric,channel,ref\n', [
        first,
      ]),
    ).toThrow('重なります');
    expect(() =>
      imp(
        'inquiry-intake',
        '2026-09-01',
        '2026-09-30',
        'occurred_at,metric,channel,ref\n2026-09-01,inquiries,form,a\n2026-09-02,inquiries,form,a\n',
      ),
    ).toThrow('ref が重複');
  });

  it('手で置いた重なるファイルがあれば集計しない', () => {
    const a = imp('inquiry-intake', '2026-08-01', '2026-08-31', fixture('inquiries.csv'));
    const b = { ...a, sha256: 'f'.repeat(64), fileName: 'copied.csv' };
    expect(() => summarizeMonth('sample-shop', '2026-08', sources, [a, b])).toThrow('二重計上');
  });

  it('同じ指標を同じ期間に持つデータ源の登録を拒否する', () => {
    const doubled = {
      ...sources,
      sources: [...sources.sources, { ...sources.sources[1]!, id: 'second-intake' }],
    };
    expect(sourcesFileSchema.safeParse(doubled).success).toBe(false);
    const wrongKind = {
      ...sources,
      sources: [{ ...sources.sources[1]!, metrics: ['page_views'] }],
    };
    expect(sourcesFileSchema.safeParse(wrongKind).success).toBe(false);
  });

  it('他の顧客のファイルが混ざれば止める', () => {
    const other = {
      ...imp('inquiry-intake', '2026-08-01', '2026-08-31', fixture('inquiries.csv')),
      customerId: 'other-shop',
    };
    expect(() => summarizeMonth('sample-shop', '2026-08', sources, [other])).toThrow(
      '顧客 ID が一致しません',
    );
    const dir = mkdtempSync(join(tmpdir(), 'ops-metrics-'));
    try {
      writeJson(join(dir, 'metrics', 'sample-shop', 'sources.json'), sources);
      writeJson(join(dir, 'metrics', 'sample-shop', 'imports', 'x.json'), other);
      expect(() => loadCustomerMetrics(dir, 'sample-shop')).toThrow('顧客 ID が一致しません');
      expect(loadCustomerMetrics(dir, 'nobody')).toEqual({
        sources: { customerId: 'nobody', sources: [] },
        imports: [],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('CSV の値・指標・期間の誤りを行番号つきで止める', () => {
    expect(() =>
      imp(
        'server-log',
        '2026-08-01',
        '2026-08-31',
        'date,metric,dimension,value\n2026-08-01,page_views,,1.5\n',
      ),
    ).toThrow('2 行目');
    expect(() =>
      imp(
        'server-log',
        '2026-08-01',
        '2026-08-31',
        'date,metric,dimension,value\n2026-08-01,inquiries,,1\n',
      ),
    ).toThrow('指標ではありません');
    expect(() =>
      imp(
        'server-log',
        '2026-08-01',
        '2026-08-31',
        'date,metric,dimension,value\n2026-09-01,visits,,1\n',
      ),
    ).toThrow('期間の外');
    expect(() =>
      imp('inquiry-intake', '2026-07-01', '2026-07-31', 'occurred_at,metric,channel,ref\n'),
    ).toThrow('同意の範囲');
  });
});

describe('前月比較', () => {
  it('両月とも計測できたときだけ差を出す', () => {
    const measured = (value: number) => ({ status: 'measured' as const, value, breakdown: {} });
    expect(compareMeasurements(measured(5), measured(2), '件')).toBe('前月比 +3件');
    expect(compareMeasurements(measured(0), measured(0), '件')).toBe('前月と同じ');
    expect(compareMeasurements(measured(5), { status: 'not_measured', reason: '' }, '件')).toBe(
      '比較できません（前月は未計測）',
    );
    expect(
      compareMeasurements(
        { status: 'missing', reason: '', missingDates: [], partialValue: 1 },
        measured(2),
        '件',
      ),
    ).toBe('比較できません（今月は欠損あり）');
  });
});
