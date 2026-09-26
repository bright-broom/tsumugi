import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReport, printReport, writeJobSummary } from '../tools/verify/report';

describe('deployment failure diagnostics', () => {
  it('prints every unmet production condition, including those beyond the sixth row', () => {
    const fields = [
      'PLACEHOLDER',
      'DOMAIN',
      'POSTAL_CODE',
      'ADDRESS_REGION',
      'ADDRESS_CITY',
      'ADDRESS_STREET',
      'MEMBERS[0].name',
      'MEMBERS[1].name',
      'MEMBERS[1].bio',
      'LEGAL_APPROVALS.terms',
      'LEGAL_APPROVALS.legal',
      'ACCEPTANCE_RECORDS',
    ];
    const report = buildReport({
      results: fields.map((page) => ({
        level: 'FAIL',
        check: '公開条件（本番）',
        page,
        detail: '未設定',
      })),
      kind: 'static',
      mode: 'production',
      measuredAt: new Date('2026-09-17T00:00:00Z'),
      commit: { sha: 'a'.repeat(40), source: 'git', dirty: false },
      artifact: { files: 50, sha256: 'b'.repeat(64) },
      lcp: null,
      acceptance: [],
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      printReport(report);
      const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
      for (const field of fields) expect(output).toContain(`FAIL ${field}: 未設定`);
      expect(output).toContain('FAIL 12');
      expect(output).toContain('納品不可');
      expect(report.counts.fail).toBe(12);
      expect(report.verdict).toBe('blocked');
    } finally {
      log.mockRestore();
    }
  });
});

describe('CI のジョブ要約', () => {
  const dirs: string[] = [];
  afterEach(() => {
    delete process.env.GITHUB_STEP_SUMMARY;
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const report = (
    results: { level: 'PASS' | 'WARN' | 'FAIL'; check: string; page: string; detail: string }[],
  ) =>
    buildReport({
      results,
      kind: 'full',
      mode: 'production',
      measuredAt: new Date('2026-09-26T00:00:00Z'),
      commit: { sha: 'a'.repeat(40), source: 'git', dirty: false },
      artifact: { files: 52, sha256: 'b'.repeat(64) },
      lcp: null,
      acceptance: [],
    });
  const summaryOf = (r: ReturnType<typeof report>) => {
    const dir = mkdtempSync(join(tmpdir(), 'tsumugi-summary-'));
    dirs.push(dir);
    const file = join(dir, 'summary.md');
    process.env.GITHUB_STEP_SUMMARY = file;
    writeJobSummary(r);
    return readFileSync(file, 'utf8');
  };

  it('不合格を先頭に、検査・ページ・内容を表で書く', () => {
    const text = summaryOf(
      report([
        { level: 'PASS', check: '13 LCP 2.5秒以内', page: 'about.html', detail: '210ms' },
        { level: 'WARN', check: '公開前チェック', page: 'config.ts', detail: '未確認の記録 3 件' },
        {
          level: 'FAIL',
          check: '13 LCP 2.5秒以内',
          page: 'index.html',
          detail: '2980ms / 要素=IMG.brand',
        },
      ]),
    );
    expect(text).toContain('PASS 1 / WARN 1 / FAIL 1');
    const fail = text.indexOf('| FAIL |');
    const warn = text.indexOf('| WARN |');
    expect(fail).toBeGreaterThan(-1);
    expect(fail).toBeLessThan(warn);
    expect(text).toContain('| FAIL | 13 LCP 2.5秒以内 | index.html | 2980ms / 要素=IMG.brand |');
    // 合格した行は書かない（直すべきところだけを見せる）
    expect(text).not.toContain('about.html');
  });

  it('不合格も警告も無ければ、その旨だけを書く', () => {
    expect(
      summaryOf(
        report([{ level: 'PASS', check: '13 LCP 2.5秒以内', page: 'index.html', detail: '210ms' }]),
      ),
    ).toContain('不合格・警告はありません');
  });

  it('GitHub Actions の外では何も書かない', () => {
    delete process.env.GITHUB_STEP_SUMMARY;
    expect(() => writeJobSummary(report([]))).not.toThrow();
  });
});
