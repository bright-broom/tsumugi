/**
 * OGP 画像の再現性の検査（#37、ADR 0047）。
 *
 * 生成したディレクトリとコミット済みの public/og/ をファイル単位のバイト列で比べる。
 * 字形は生成環境の書体に依存するため、正本の環境（OG_REFERENCE）の条件も並べて出す。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 2026-09-16 にコミット済みの 24 ファイルとバイト一致を確かめた生成環境 */
export const OG_REFERENCE = {
  platform: 'darwin',
  macOS: '15.8',
  playwright: '1.63.0',
  chromium: '153.0.8010.12',
  fonts: 'Hiragino Sans W5・W6・W8（macOS 標準のヒラギノ角ゴシック）',
} as const;

export interface OgEnvironment {
  platform: string;
  macOS: string | null;
  playwright: string | null;
  chromium: string | null;
}

export interface DirComparison {
  same: string[];
  different: { file: string; expectedBytes: number; actualBytes: number }[];
  /** 基準にあって生成されなかった */
  missing: string[];
  /** 生成されたが基準にない */
  extra: string[];
}

const filesIn = (dir: string) =>
  readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isFile())
    .sort();

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

export function compareDirs(expectedDir: string, actualDir: string): DirComparison {
  const expected = filesIn(expectedDir);
  const actual = new Set(filesIn(actualDir));
  const result: DirComparison = { same: [], different: [], missing: [], extra: [] };
  for (const file of expected) {
    if (!actual.has(file)) {
      result.missing.push(file);
      continue;
    }
    const left = readFileSync(join(expectedDir, file));
    const right = readFileSync(join(actualDir, file));
    if (sha256(left) === sha256(right)) result.same.push(file);
    else result.different.push({ file, expectedBytes: left.length, actualBytes: right.length });
  }
  result.extra = [...actual].filter((file) => !expected.includes(file)).sort();
  return result;
}

export const isIdentical = (comparison: DirComparison) =>
  !comparison.different.length && !comparison.missing.length && !comparison.extra.length;

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

export function currentEnvironment(root: string): OgEnvironment {
  let macOS: string | null = null;
  if (process.platform === 'darwin') {
    try {
      macOS = execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim();
    } catch {
      macOS = null;
    }
  }
  const playwright = readJson(join(root, 'node_modules', 'playwright', 'package.json')) as {
    version?: string;
  } | null;
  const browsers = readJson(join(root, 'node_modules', 'playwright-core', 'browsers.json')) as {
    browsers?: { name: string; browserVersion?: string }[];
  } | null;
  const shell = browsers?.browsers?.find((entry) => entry.name === 'chromium-headless-shell');
  const chromium = shell ?? browsers?.browsers?.find((entry) => entry.name === 'chromium');
  return {
    platform: process.platform,
    macOS,
    playwright: playwright?.version ?? null,
    chromium: chromium?.browserVersion ?? null,
  };
}

/** 正本の環境との違い。違いがあっても比較は行うが、差分が出たときの原因の候補になる。 */
export function referenceGaps(environment: OgEnvironment): string[] {
  const gaps: string[] = [];
  if (environment.platform !== OG_REFERENCE.platform)
    gaps.push(`OS が ${environment.platform}（正本は macOS。書体が変わるため一致しない見込み）`);
  else if (environment.macOS !== OG_REFERENCE.macOS)
    gaps.push(
      `macOS ${environment.macOS ?? '不明'}（正本は ${OG_REFERENCE.macOS}。書体の版が変わりうる）`,
    );
  if (environment.playwright !== OG_REFERENCE.playwright)
    gaps.push(
      `Playwright ${environment.playwright ?? '不明'}（正本は ${OG_REFERENCE.playwright}）`,
    );
  if (environment.chromium !== OG_REFERENCE.chromium)
    gaps.push(`Chromium ${environment.chromium ?? '不明'}（正本は ${OG_REFERENCE.chromium}）`);
  return gaps;
}

export const hasDirectory = (dir: string) => existsSync(dir) && statSync(dir).isDirectory();
