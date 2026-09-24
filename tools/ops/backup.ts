/**
 * 週次バックアップの作成（#31、ADR 0045）。
 *
 * 対象は Git が追跡しているファイルの全体（ソース・src/assets と public の素材・文書・設定）と、
 * HEAD までの全履歴。git bundle 1 つと、ファイルごとの SHA-256 を持つ目録、チェックサムを書く。
 * 除外（.env*・.vercel・生成物・node_modules）は .gitignore が正本で、ここでは二重に拒否する。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATED_PUBLIC } from '../paths';

export const BUNDLE = 'repo.bundle';
export const MANIFEST = 'manifest.json';
export const CHECKSUMS = 'SHA256SUMS';

const EXCLUDED: readonly { rule: string; test: (path: string) => boolean }[] = [
  {
    rule: '.env*（.env.example を除く）',
    test: (path) =>
      path.split('/').some((part) => part.startsWith('.env') && part !== '.env.example'),
  },
  { rule: '.vercel/', test: (path) => path.split('/').includes('.vercel') },
  { rule: 'node_modules/', test: (path) => path.split('/').includes('node_modules') },
  {
    rule: '生成物（out/・.next/・.artifacts/・coverage/）',
    test: (path) => /^(?:out|\.next|\.artifacts|coverage)\//.test(path),
  },
  {
    rule: `生成物（${GENERATED_PUBLIC.join('・')}）`,
    test: (path) => (GENERATED_PUBLIC as readonly string[]).includes(path),
  },
  {
    rule: '鍵・証明書ファイル（*.pem・*.key・*.p12・*.pfx）',
    test: (path) => /\.(?:pem|key|p12|pfx)$/i.test(path),
  },
];

/** 追跡してはいけないパスを「パス（理由）」で返す。 */
export function excludedPaths(paths: readonly string[]): string[] {
  return paths.flatMap((path) => {
    const hit = EXCLUDED.find((entry) => entry.test(path));
    return hit ? [`${path}（${hit.rule}）`] : [];
  });
}

const SECRET_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ['秘密鍵', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['GitHub のトークン', /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['AWS のアクセスキー', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack のトークン', /\bxox[abprs]-[0-9A-Za-z-]{10,}/],
  ['Stripe の本番キー', /\b[rs]k_live_[0-9A-Za-z]{20,}/],
];

/** 典型的な秘密情報の形を探す（誤検知を避けるため、形の決まったものだけ）。 */
export function findSecrets(path: string, content: string): string[] {
  return SECRET_PATTERNS.flatMap(([label, pattern]) =>
    pattern.test(content) ? [`${path}: ${label}の形の文字列`] : [],
  );
}

export type Category = 'source' | 'assets' | 'docs' | 'settings';

export function categoryOf(path: string): Category {
  if (path.startsWith('src/assets/') || path.startsWith('public/')) return 'assets';
  if (/^(?:src|tools|tests)\//.test(path)) return 'source';
  if (path.startsWith('docs/') || /^[^/]+\.md$/.test(path)) return 'docs';
  return 'settings';
}

interface FileDigest {
  path: string;
  bytes: number;
  sha256: string;
}

export interface Manifest {
  format: 1;
  createdAt: string;
  commit: string;
  ref: string;
  bundle: { file: string; bytes: number; sha256: string };
  totals: Record<Category, { files: number; bytes: number }>;
  excludedRules: string[];
  files: FileDigest[];
}

export const git = (cwd: string, args: readonly string[]) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 256 * 1024 * 1024,
  });

export const trackedFiles = (cwd: string) =>
  git(cwd, ['ls-files', '-z']).split('\0').filter(Boolean);

/** Git と同じく、シンボリックリンクはリンク先の文字列を中身として数える。 */
export function digest(file: string): { bytes: number; sha256: string } {
  const data = lstatSync(file).isSymbolicLink()
    ? Buffer.from(readlinkSync(file))
    : readFileSync(file);
  return { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}

const SCAN_LIMIT_BYTES = 5 * 1024 * 1024;

export function createBackup({
  root,
  outDir,
  now = new Date(),
}: {
  root: string;
  outDir: string;
  now?: Date;
}): { dir: string; manifest: Manifest } {
  const dirty = git(root, ['status', '--porcelain', '--untracked-files=normal']).trim();
  if (dirty)
    throw new Error(
      `未コミットの変更はバックアップに入りません。コミットしてから実行してください:\n${dirty}`,
    );

  const paths = trackedFiles(root);
  const excluded = excludedPaths(paths);
  if (excluded.length)
    throw new Error(
      `バックアップに入れてはいけないファイルが追跡されています:\n${excluded.join('\n')}`,
    );

  const secrets = paths.flatMap((path) => {
    const file = join(root, path);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || stat.size > SCAN_LIMIT_BYTES) return [];
    const data = readFileSync(file);
    return data.includes(0) ? [] : findSecrets(path, data.toString('utf8'));
  });
  if (secrets.length)
    throw new Error(`秘密情報の可能性がある文字列が追跡されています:\n${secrets.join('\n')}`);

  const commit = git(root, ['rev-parse', 'HEAD']).trim();
  let branch = '';
  try {
    branch = git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).trim();
  } catch {
    // 切り離された HEAD（CI のチェックアウトなど）は HEAD だけを記録する
  }
  const files = paths.map((path) => ({ path, ...digest(join(root, path)) }));
  const totals: Manifest['totals'] = {
    source: { files: 0, bytes: 0 },
    assets: { files: 0, bytes: 0 },
    docs: { files: 0, bytes: 0 },
    settings: { files: 0, bytes: 0 },
  };
  for (const file of files) {
    totals[categoryOf(file.path)].files += 1;
    totals[categoryOf(file.path)].bytes += file.bytes;
  }

  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const dir = join(outDir, `tsumugi-${stamp}-${commit.slice(0, 7)}`);
  mkdirSync(dir, { recursive: true });
  git(root, [
    'bundle',
    'create',
    '--quiet',
    join(dir, BUNDLE),
    'HEAD',
    ...(branch ? [branch] : []),
  ]);

  const manifest: Manifest = {
    format: 1,
    createdAt: now.toISOString(),
    commit,
    ref: branch || 'HEAD',
    bundle: { file: BUNDLE, ...digest(join(dir, BUNDLE)) },
    totals,
    excludedRules: EXCLUDED.map((entry) => entry.rule),
    files,
  };
  writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    join(dir, CHECKSUMS),
    `${manifest.bundle.sha256}  ${BUNDLE}\n${digest(join(dir, MANIFEST)).sha256}  ${MANIFEST}\n`,
  );
  return { dir, manifest };
}
