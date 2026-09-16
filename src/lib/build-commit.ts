import { execFileSync } from 'node:child_process';
import type { CommitInfo } from '@/lib/verification-report';

/** git の出力（前後の空白を除く）。git が無い・リポジトリでない・失敗したときは null */
export type GitRunner = (args: string[]) => string | null;

export function gitRunner(cwd: string): GitRunner {
  return (args) => {
    try {
      return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };
}

const SHA = /^[0-9a-f]{40}$/;

/**
 * 検査・ビルドの対象コミット。CI が渡す GITHUB_SHA、Vercel が渡す VERCEL_GIT_COMMIT_SHA、
 * git rev-parse HEAD の順に使う。未コミットの変更は、git の HEAD が同じコミットのときだけ判定し、
 * 判定できなければ null（分からないものを「変更なし」と扱わない）。
 * node:child_process を使うので getStaticProps と検査ツールからだけ呼ぶ。
 */
export function resolveCommit(env: Readonly<Record<string, string | undefined>>, git: GitRunner): CommitInfo {
  const named = (['GITHUB_SHA', 'VERCEL_GIT_COMMIT_SHA'] as const).find((key) =>
    SHA.test(env[key] ?? ''),
  );
  const head = git(['rev-parse', 'HEAD']);
  const sha = named ? env[named]! : head !== null && SHA.test(head) ? head : null;
  const status = sha !== null && head === sha ? git(['status', '--porcelain']) : null;
  return {
    sha,
    source: named ?? (sha ? 'git' : 'unknown'),
    dirty: status === null ? null : status !== '',
  };
}
