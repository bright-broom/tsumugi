import { z } from 'zod';

/**
 * 検査レポート（.artifacts/verification/verify-report*.json）の形と、ページに件数を出してよいかの判定。
 * 書くのは tools/verify/report.ts、読むのは lib/measured.ts（getStaticProps の中だけ）。
 * 判定は純粋関数にし、ファイルや git には触らない（ADR 0025）。
 */
export const REPORT_SCHEMA_VERSION = 1;

const count = z.number().int().nonnegative();
const commitSha = z.string().regex(/^[0-9a-f]{40}$/);

const commitSchema = z.object({
  sha: commitSha.nullable(),
  source: z.enum(['GITHUB_SHA', 'VERCEL_GIT_COMMIT_SHA', 'git', 'unknown']),
  /** 未コミットの変更があるか。git が使えず分からないときは null */
  dirty: z.boolean().nullable(),
});
export type CommitInfo = z.infer<typeof commitSchema>;

const levelSchema = z.enum(['PASS', 'WARN', 'FAIL', 'N/A']);
export type ReportLevel = z.infer<typeof levelSchema>;

const acceptanceSchema = z.object({
  id: z.string(),
  method: z.enum(['auto', 'auto+manual', 'manual', 'external']),
  automated: z.object({
    checks: z.array(z.string()),
    status: z.enum(['pass', 'fail', 'not-run', 'no-target', 'none']),
  }),
  human: z.object({
    required: z.boolean(),
    status: z.enum(['confirmed', 'not-applicable', 'pending', 'none']),
    checkedOn: z.string().nullable(),
  }),
});
export type AcceptanceEntry = z.infer<typeof acceptanceSchema>;

const verificationReportSchema = z.object({
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  /** full＝静的検査＋ブラウザ実測、static＝静的検査だけ */
  kind: z.enum(['full', 'static']),
  mode: z.enum(['preview', 'production']),
  measuredAt: z.iso.datetime(),
  commit: commitSchema,
  /** 検査した成果物（out/）のファイル数と、全ファイルの内容から作った SHA-256 */
  artifact: z.object({ files: count, sha256: z.string().regex(/^[0-9a-f]{64}$/) }),
  counts: z.object({ pass: count, warn: count, fail: count, notApplicable: count }),
  verdict: z.enum(['deliverable', 'blocked']),
  lcp: z.object({ worstMs: z.number().nonnegative(), pages: count }).nullable(),
  acceptance: z.array(acceptanceSchema),
  results: z.array(
    z.object({ level: levelSchema, check: z.string(), page: z.string(), detail: z.string() }),
  ),
});
export type VerificationReport = z.infer<typeof verificationReportSchema>;

/** ページに出す検査の実績。全項目・FAIL 0・このビルドと同じコミットのレポートからだけ作る */
export interface VerifiedSummary {
  pass: number;
  warn: number;
  /** 検査した日（日本時間 YYYY-MM-DD） */
  measuredOn: string;
  /** 検査したコミットの先頭 7 文字 */
  commit: string;
}

type RejectReason =
  | 'missing'
  | 'invalid'
  | 'inconsistent'
  | 'static-only'
  | 'has-failures'
  | 'commit-unknown'
  | 'other-commit'
  | 'uncommitted-changes';

export type Adoption = { ok: true; summary: VerifiedSummary } | { ok: false; reason: RejectReason };

export function tally(results: readonly { level: ReportLevel }[]): VerificationReport['counts'] {
  const n = (level: ReportLevel) => results.filter((r) => r.level === level).length;
  return { pass: n('PASS'), warn: n('WARN'), fail: n('FAIL'), notApplicable: n('N/A') };
}

/** 日本時間の日付（YYYY-MM-DD） */
export function tokyoDate(at: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at));
}

/**
 * レポートを表示の根拠として採用するか。採用しない理由も返す。
 * 失敗を含む・静的検査だけ・別のコミット・未コミットの変更がある（または分からない）レポートは使わない。
 */
export function adoptReport(raw: unknown, current: CommitInfo): Adoption {
  const parsed = verificationReportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const report = parsed.data;
  const counted = tally(report.results);
  const consistent =
    counted.pass === report.counts.pass &&
    counted.warn === report.counts.warn &&
    counted.fail === report.counts.fail &&
    counted.notApplicable === report.counts.notApplicable &&
    report.verdict === (counted.fail ? 'blocked' : 'deliverable');
  if (!consistent) return { ok: false, reason: 'inconsistent' };
  if (report.kind !== 'full') return { ok: false, reason: 'static-only' };
  if (report.counts.fail > 0) return { ok: false, reason: 'has-failures' };
  if (!report.commit.sha || !current.sha) return { ok: false, reason: 'commit-unknown' };
  if (report.commit.sha !== current.sha) return { ok: false, reason: 'other-commit' };
  if (report.commit.dirty !== false || current.dirty !== false)
    return { ok: false, reason: 'uncommitted-changes' };
  return {
    ok: true,
    summary: {
      pass: report.counts.pass,
      warn: report.counts.warn,
      measuredOn: tokyoDate(report.measuredAt),
      commit: report.commit.sha.slice(0, 7),
    },
  };
}
