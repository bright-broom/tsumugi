import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gitRunner, resolveCommit, type GitRunner } from '@/lib/build-commit';
import { adoptReport, type Adoption, type VerifiedSummary } from '@/lib/verification-report';

interface Options {
  /** 既定は <起動ディレクトリ>/.artifacts/verification/verify-report.json（全項目の結果だけ。静的検査の結果は別ファイル） */
  reportPath?: string;
  env?: Readonly<Record<string, string | undefined>>;
  git?: GitRunner;
}

/**
 * ビルド中のコミットに対応する、全項目・FAIL 0 の検査レポートを読む。
 * 「測っていない数字は書かない」ので、採用できなければ理由を返し、ページは「—」（未計測）を出す。
 * node:fs・node:child_process を使うので getStaticProps の中からだけ呼ぶこと。
 */
export function readVerification(options: Options = {}): Adoption {
  const cwd = process.cwd();
  let raw: unknown;
  try {
    raw = JSON.parse(
      readFileSync(
        options.reportPath ?? join(cwd, '.artifacts', 'verification', 'verify-report.json'),
        'utf-8',
      ),
    );
  } catch {
    return { ok: false, reason: 'missing' };
  }
  return adoptReport(raw, resolveCommit(options.env ?? process.env, options.git ?? gitRunner(cwd)));
}

export function verifiedSummary(options: Options = {}): VerifiedSummary | null {
  const adoption = readVerification(options);
  return adoption.ok ? adoption.summary : null;
}
