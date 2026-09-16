import { describe, expect, it, vi } from 'vitest';
import { buildReport, printReport } from '../tools/verify/report';

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
