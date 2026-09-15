import { describe, expect, it } from 'vitest';
import { resolveCommit, type GitRunner } from '@/lib/build-commit';
import { adoptReport, type CommitInfo } from '@/lib/verification-report';
import { buildReport } from '../tools/verify/report';
import type { Result } from '../tools/verify/results';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const clean: CommitInfo = { sha: A, source: 'git', dirty: false };
const results: Result[] = [
  { level: 'PASS', check: '01', page: 'index.html', detail: '' },
  { level: 'PASS', check: '01', page: 'price.html', detail: '' },
  { level: 'WARN', check: '公開前チェック', page: 'config.ts', detail: '' },
  { level: 'N/A', check: '07 imgのalt', page: 'faq.html', detail: '対象なし（画像0枚）' },
];

function report(overrides: Partial<Parameters<typeof buildReport>[0]> = {}): unknown {
  return JSON.parse(
    JSON.stringify(
      buildReport({
        results,
        kind: 'full',
        mode: 'preview',
        // 日本時間では 2026-09-16 01:30
        measuredAt: new Date('2026-09-15T16:30:00Z'),
        commit: clean,
        artifact: { files: 50, sha256: 'c'.repeat(64) },
        lcp: { worstMs: 180, pages: 21 },
        acceptance: [],
        ...overrides,
      }),
    ),
  );
}

describe('検査・ビルドの対象コミット', () => {
  const git =
    (head: string | null, status: string | null): GitRunner =>
    (args) =>
      args[0] === 'rev-parse' ? head : status;

  it('CI の GITHUB_SHA を使い、チェックアウトが同じコミットなら未コミットの変更を調べる', () => {
    expect(resolveCommit({ GITHUB_SHA: A }, git(A, ''))).toEqual({
      sha: A,
      source: 'GITHUB_SHA',
      dirty: false,
    });
  });
  it('Vercel のビルドのように git が無ければ、変更の有無は「不明」にする', () => {
    expect(resolveCommit({ VERCEL_GIT_COMMIT_SHA: A }, git(null, null))).toEqual({
      sha: A,
      source: 'VERCEL_GIT_COMMIT_SHA',
      dirty: null,
    });
  });
  it('手元では git rev-parse と git status から判定する', () => {
    expect(resolveCommit({}, git(A, ' M src/content/config.ts'))).toEqual({
      sha: A,
      source: 'git',
      dirty: true,
    });
  });
  it('環境変数と HEAD が違えば、変更の有無を推測しない', () => {
    expect(resolveCommit({ GITHUB_SHA: A }, git(B, '')).dirty).toBeNull();
  });
  it('コミットの形でない値は使わない', () => {
    expect(resolveCommit({ GITHUB_SHA: 'main' }, git(null, null))).toEqual({
      sha: null,
      source: 'unknown',
      dirty: null,
    });
  });
});

describe('実測レポートの採用', () => {
  it('全項目・FAIL 0・同じコミット・未コミットの変更なしのレポートだけを採用する', () => {
    expect(adoptReport(report(), clean)).toEqual({
      ok: true,
      summary: { pass: 2, warn: 1, measuredOn: '2026-09-16', commit: 'aaaaaaa' },
    });
  });

  it.each<[string, unknown, CommitInfo]>([
    ['static-only', report({ kind: 'static' }), clean],
    [
      'has-failures',
      report({ results: [...results, { level: 'FAIL', check: '13 LCP', page: 'index.html', detail: '' }] }),
      clean,
    ],
    ['other-commit', report(), { ...clean, sha: B }],
    ['uncommitted-changes', report({ commit: { ...clean, dirty: true } }), clean],
    ['uncommitted-changes', report(), { ...clean, dirty: null }],
    ['uncommitted-changes', report(), { ...clean, dirty: true }],
    ['commit-unknown', report({ commit: { sha: null, source: 'unknown', dirty: null } }), clean],
    ['commit-unknown', report(), { sha: null, source: 'unknown', dirty: null }],
  ])('%s のレポートを実績にしない', (reason, raw, current) => {
    expect(adoptReport(raw, current)).toEqual({ ok: false, reason });
  });

  it('件数や判定を書き換えたレポートを実績にしない', () => {
    const edited = report() as { counts: { pass: number } };
    edited.counts.pass = 999;
    expect(adoptReport(edited, clean)).toEqual({ ok: false, reason: 'inconsistent' });
    const verdict = report() as { verdict: string };
    verdict.verdict = 'blocked';
    expect(adoptReport(verdict, clean)).toEqual({ ok: false, reason: 'inconsistent' });
  });

  it.each([{}, { pass: 581 }, null, 'broken', { ...(report() as object), measuredAt: 'yesterday' }])(
    '形の合わないレポート（旧形式を含む）を実績にしない: %j',
    (raw) => {
      expect(adoptReport(raw, clean)).toEqual({ ok: false, reason: 'invalid' });
    },
  );
});
