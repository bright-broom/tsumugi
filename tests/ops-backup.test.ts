import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BUNDLE,
  categoryOf,
  createBackup,
  excludedPaths,
  findSecrets,
  trackedFiles,
} from '../tools/ops/backup';
import { restoreTest } from '../tools/ops/restore';

const ROOT = join(import.meta.dirname, '..');
const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const tempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
};

const run = (cwd: string, ...args: string[]) =>
  execFileSync(
    'git',
    [
      '-c',
      'user.name=backup-test',
      '-c',
      'user.email=backup-test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    {
      cwd,
      encoding: 'utf8',
    },
  );

function fixtureRepo() {
  const repo = tempDir('tsumugi-backup-repo-');
  run(repo, 'init', '--quiet', '-b', 'main');
  const files: Record<string, string | Buffer> = {
    'package.json': '{"name":"fixture"}\n',
    'src/pages/index.tsx': 'export default function Page() { return null; }\n',
    'src/assets/hero/photo.webp': Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x01]),
    'docs/operations.md': '# 運用\n',
    '.gitignore': 'out/\n.env*\n!.env.example\n',
    '.env.example': 'FORM_ENDPOINT=\n',
  };
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(repo, path, '..'), { recursive: true });
    writeFileSync(join(repo, path), body);
  }
  writeFileSync(join(repo, '.env.local'), 'SECRET=never-backed-up\n');
  run(repo, 'add', '.');
  run(repo, 'commit', '--quiet', '-m', 'fixture');
  return repo;
}

describe('バックアップの対象と除外', () => {
  it.each([
    '.env',
    '.env.local',
    'apps/site/.env.production',
    '.vercel/project.json',
    'node_modules/next/package.json',
    'out/index.html',
    '.next/cache/x',
    'public/theme.css',
    'certs/server.pem',
  ])('追跡してはいけない: %s', (path) => expect(excludedPaths([path])).toHaveLength(1));

  it.each([
    '.env.example',
    'src/assets/hero/onokoro.webp',
    'public/og/index.png',
    'docs/status.md',
  ])('対象にする: %s', (path) => expect(excludedPaths([path])).toEqual([]));

  it('分類はソース・素材・文書・設定', () => {
    expect(
      [
        'src/views/home.tsx',
        'tools/ops/backup.ts',
        'src/assets/hero/onokoro.webp',
        'public/og/index.png',
        'docs/spec.md',
        'AGENTS.md',
        'package.json',
        '.github/workflows/ci.yml',
      ].map(categoryOf),
    ).toEqual(['source', 'source', 'assets', 'assets', 'docs', 'docs', 'settings', 'settings']);
  });

  it('形の決まった秘密情報を見つけ、説明文の言及は拾わない', () => {
    // 検査対象のリポジトリ自体に引っかからないよう、文字列を分割して組み立てる
    const token = ['gh', 'p_', 'a'.repeat(36)].join('');
    const key = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
    expect(findSecrets('a.ts', `const t = "${token}";`)).toHaveLength(1);
    expect(findSecrets('b.pem.txt', key)).toHaveLength(1);
    expect(findSecrets('c.md', 'GitHub のトークン（ghp_ で始まる）は Secret に置く')).toEqual([]);
  });

  it('このリポジトリの追跡ファイルに除外対象と秘密情報の形がない', () => {
    const paths = trackedFiles(ROOT);
    expect(excludedPaths(paths)).toEqual([]);
    const secrets = paths.flatMap((path) => {
      try {
        const data = readFileSync(join(ROOT, path));
        return data.includes(0) ? [] : findSecrets(path, data.toString('utf8'));
      } catch {
        return []; // 作業中に消したファイル
      }
    });
    expect(secrets).toEqual([]);
  });
});

describe('バックアップと復元テスト', () => {
  it('バンドルと目録を作り、別ディレクトリへの復元で全ファイルのハッシュが一致する', () => {
    const repo = fixtureRepo();
    const out = tempDir('tsumugi-backup-out-');
    const { dir, manifest } = createBackup({
      root: repo,
      outDir: out,
      now: new Date('2026-09-16T01:02:03Z'),
    });
    expect(dir).toMatch(/tsumugi-20260916T010203Z-[0-9a-f]{7}$/);
    expect(manifest.files.map((file) => file.path)).not.toContain('.env.local');
    expect(manifest.totals).toMatchObject({
      source: { files: 1 },
      assets: { files: 1 },
      docs: { files: 1 },
      settings: { files: 3 },
    });

    const report = restoreTest({
      backupDir: dir,
      workDir: tempDir('tsumugi-restore-'),
      deps: 'none',
      build: 'none',
    });
    expect(report.steps.map((step) => [step.name, step.ok])).toEqual([
      ['チェックサムの照合', true],
      ['バンドルから別ディレクトリへ clone', true],
      ['ファイルと目録の照合', true],
      ['依存の用意', true],
      ['ビルドの確認', true],
    ]);
    expect(report.ok).toBe(true);
    expect(report.commit).toBe(manifest.commit);
  });

  it('バンドルが壊れていたら最初の段階で止まる', () => {
    const repo = fixtureRepo();
    const { dir } = createBackup({ root: repo, outDir: tempDir('tsumugi-backup-out-') });
    const bundle = readFileSync(join(dir, BUNDLE));
    bundle.writeUInt8(bundle.readUInt8(bundle.length - 1) ^ 0xff, bundle.length - 1);
    writeFileSync(join(dir, BUNDLE), bundle);
    const report = restoreTest({
      backupDir: dir,
      workDir: tempDir('tsumugi-restore-'),
      deps: 'none',
      build: 'none',
    });
    expect(report.ok).toBe(false);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]!.detail).toContain('SHA-256 が一致しない');
  });

  it('未コミットの変更と、追跡された .env は拒否する', () => {
    const repo = fixtureRepo();
    writeFileSync(join(repo, 'docs/operations.md'), '# 変更中\n');
    expect(() => createBackup({ root: repo, outDir: tempDir('tsumugi-backup-out-') })).toThrow(
      '未コミット',
    );
    run(repo, 'checkout', '--quiet', '--', 'docs/operations.md');
    run(repo, 'add', '--force', '.env.local');
    run(repo, 'commit', '--quiet', '-m', 'mistake');
    expect(() => createBackup({ root: repo, outDir: tempDir('tsumugi-backup-out-') })).toThrow(
      '.env.local',
    );
  });
});
