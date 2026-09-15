/**
 * バックアップからの復元テスト（#31、ADR 0045）。
 *
 * 別ディレクトリに clone し、目録のハッシュと照合し、依存を用意してビルドできるかを確かめ、
 * 段階ごとの所要時間を記録する。1 段階でも失敗したら、そこで止める。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUNDLE,
  CHECKSUMS,
  MANIFEST,
  digest,
  excludedPaths,
  git,
  trackedFiles,
  type Manifest,
} from './backup';

export type DepsMode = 'ci' | 'clone' | 'link' | 'none';
export type BuildMode = 'build' | 'typecheck' | 'none';

interface RestoreStep {
  name: string;
  ok: boolean;
  ms: number;
  detail: string;
}

export interface RestoreReport {
  backup: string;
  commit: string;
  startedAt: string;
  ok: boolean;
  totalMs: number;
  deps: DepsMode;
  build: BuildMode;
  environment: { node: string; platform: string; arch: string };
  steps: RestoreStep[];
}

interface RestoreOptions {
  backupDir: string;
  workDir: string;
  deps: DepsMode;
  build: BuildMode;
  /** deps=link のとき node_modules を借りる元（package-lock.json が同じであること） */
  sourceRoot?: string;
  keep?: boolean;
}

const tail = (error: unknown) => {
  const output = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
  const text =
    `${output.stdout ?? ''}${output.stderr ?? ''}`.trim() || String(output.message ?? error);
  return text.split('\n').slice(-15).join('\n');
};

export function restoreTest(options: RestoreOptions): RestoreReport {
  const { backupDir, workDir, deps, build } = options;
  if (deps === 'link' && build === 'build')
    throw new Error(
      '--deps link ではビルドを確かめられない（Next.js の Turbopack はプロジェクトの外を指す node_modules のリンクを拒否する）。--deps ci か clone を使う',
    );
  const repo = join(workDir, 'repo');
  const steps: RestoreStep[] = [];
  const startedAt = new Date();
  let manifest: Manifest | undefined;

  const run = (name: string, action: () => string) => {
    const started = performance.now();
    try {
      const detail = action();
      steps.push({ name, ok: true, ms: Math.round(performance.now() - started), detail });
      return true;
    } catch (error) {
      steps.push({
        name,
        ok: false,
        ms: Math.round(performance.now() - started),
        detail: tail(error),
      });
      return false;
    }
  };

  const ok =
    run('チェックサムの照合', () => {
      const lines = readFileSync(join(backupDir, CHECKSUMS), 'utf8').trim().split('\n');
      const listed = new Map(lines.map((line) => [line.slice(66), line.slice(0, 64)]));
      for (const file of [BUNDLE, MANIFEST]) {
        const expected = listed.get(file);
        if (!expected) throw new Error(`${CHECKSUMS} に ${file} がない`);
        if (digest(join(backupDir, file)).sha256 !== expected)
          throw new Error(`${file} の SHA-256 が一致しない（壊れているか書き換えられている）`);
      }
      manifest = JSON.parse(readFileSync(join(backupDir, MANIFEST), 'utf8')) as Manifest;
      if (manifest.format !== 1) throw new Error(`目録の形式が未対応: ${String(manifest.format)}`);
      return `${BUNDLE}・${MANIFEST} が一致（commit ${manifest.commit.slice(0, 7)}）`;
    }) &&
    run('バンドルから別ディレクトリへ clone', () => {
      if (existsSync(repo)) throw new Error(`復元先が既にある: ${repo}`);
      git(workDir, ['clone', '--quiet', '--no-checkout', join(backupDir, BUNDLE), repo]);
      git(repo, ['bundle', 'verify', '--quiet', join(backupDir, BUNDLE)]);
      git(repo, [
        '-c',
        'advice.detachedHead=false',
        'checkout',
        '--quiet',
        '--detach',
        manifest!.commit,
      ]);
      const count = git(repo, ['rev-list', '--count', 'HEAD']).trim();
      return `${repo} に commit ${manifest!.commit.slice(0, 7)} を展開（履歴 ${count} 件）`;
    }) &&
    run('ファイルと目録の照合', () => {
      const restored = trackedFiles(repo);
      const expected = new Map(manifest!.files.map((file) => [file.path, file.sha256]));
      const problems = [
        ...restored.filter((path) => !expected.has(path)).map((path) => `目録にない: ${path}`),
        ...[...expected.keys()]
          .filter((path) => !restored.includes(path))
          .map((path) => `復元されない: ${path}`),
        ...restored
          .filter(
            (path) => expected.has(path) && digest(join(repo, path)).sha256 !== expected.get(path),
          )
          .map((path) => `ハッシュ不一致: ${path}`),
        ...excludedPaths(restored).map((path) => `除外対象: ${path}`),
      ];
      if (problems.length) throw new Error(problems.slice(0, 20).join('\n'));
      const bytes = manifest!.files.reduce((sum, file) => sum + file.bytes, 0);
      return `${restored.length} ファイル・${bytes.toLocaleString('en-US')} バイトが一致、除外対象なし`;
    }) &&
    run('依存の用意', () => {
      if (deps === 'none') return '省略（--deps none）';
      if (deps === 'ci') {
        execFileSync('npm', ['ci', '--no-audit', '--no-fund'], {
          cwd: repo,
          encoding: 'utf8',
          stdio: 'pipe',
        });
        return 'npm ci';
      }
      const source = options.sourceRoot;
      if (!source) throw new Error(`--deps ${deps} には借りる元のディレクトリが要る`);
      const lock = 'package-lock.json';
      if (digest(join(repo, lock)).sha256 !== digest(join(source, lock)).sha256)
        throw new Error(
          `${lock} が借りる元と違うため node_modules を共有できない（--deps ci を使う）`,
        );
      if (deps === 'clone') {
        if (process.platform !== 'darwin')
          throw new Error('--deps clone は macOS（APFS のクローン）でだけ使える');
        execFileSync('cp', ['-cR', join(source, 'node_modules'), join(repo, 'node_modules')], {
          stdio: 'pipe',
        });
        return `package-lock.json が一致したため ${source}/node_modules を APFS のクローンで複製（インストール時間は含まない）`;
      }
      symlinkSync(join(source, 'node_modules'), join(repo, 'node_modules'), 'dir');
      return `package-lock.json が一致したため ${source}/node_modules をシンボリックリンクで参照（インストール時間は含まない）`;
    }) &&
    run('ビルドの確認', () => {
      if (build === 'none') return '省略（--build none）';
      if (build === 'typecheck') {
        execFileSync('npm', ['exec', '--', 'tsc', '--noEmit'], {
          cwd: repo,
          encoding: 'utf8',
          stdio: 'pipe',
        });
        return '型検査（tsc --noEmit）が通った';
      }
      execFileSync('npm', ['run', 'build'], { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
      const pages = readdirSync(join(repo, 'out')).filter((file) => file.endsWith('.html'));
      if (!pages.includes('index.html')) throw new Error('out/index.html がない');
      return `npm run build が通り、out/ に HTML ${pages.length} 件`;
    });

  if (!options.keep) rmSync(repo, { recursive: true, force: true });
  return {
    backup: backupDir,
    commit: manifest?.commit ?? '',
    startedAt: startedAt.toISOString(),
    ok,
    totalMs: steps.reduce((sum, step) => sum + step.ms, 0),
    deps,
    build,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    steps,
  };
}
