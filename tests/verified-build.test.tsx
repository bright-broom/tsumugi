/**
 * 結合テスト：通常の Git 配備で、works.html に出る検査件数と、その根拠のレポートが一致すること（#34）。
 * 配備の手順（verify → レポート → ビルド時の読み込み → ページの描画）を、実際のモジュールでつないで確かめる。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import { LCP_RECORDED_ON } from '@/content/measurements';
import { getMessages } from '@/i18n/catalog';
import type { GitRunner } from '@/lib/build-commit';
import { readVerification, verifiedSummary } from '@/lib/measured';
import type { VerifiedSummary } from '@/lib/verification-report';
import { buildReport } from '../tools/verify/report';
import type { Result } from '../tools/verify/results';

const SHA = '1234567'.padEnd(40, '0');
const PREVIOUS = '7654321'.padEnd(40, '0');
const copy = getMessages().works;

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'tsumugi-verified-build-'));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const passing: Result[] = [
  ...['index.html', 'price.html', 'works.html'].map((page): Result => ({
    level: 'PASS',
    check: '13 LCP 2.5秒以内',
    page,
    detail: '',
  })),
  { level: 'WARN', check: '公開前チェック', page: 'config.ts', detail: '' },
];

/** verify が書くのと同じ形のレポートを、配備ごとの作業ディレクトリに置く */
function verifyWrites(
  dir: string,
  file: string,
  input: { kind?: 'full' | 'static'; sha?: string; dirty?: boolean | null; results?: Result[] } = {},
) {
  mkdirSync(join(root, dir), { recursive: true });
  const report = buildReport({
    results: input.results ?? passing,
    kind: input.kind ?? 'full',
    mode: 'preview',
    measuredAt: new Date('2026-09-16T03:00:00Z'),
    commit: { sha: input.sha ?? SHA, source: 'git', dirty: input.dirty ?? false },
    artifact: { files: 50, sha256: 'e'.repeat(64) },
    lcp: { worstMs: 180, pages: 21 },
    acceptance: [],
  });
  writeFileSync(join(root, dir, file), JSON.stringify(report));
  return report;
}

const noGit: GitRunner = () => null;
const cleanCheckout =
  (sha: string): GitRunner =>
  (args) =>
    args[0] === 'rev-parse' ? sha : '';

function renderWorks(verification: VerifiedSummary | null) {
  const html = renderToStaticMarkup(<Page {...{ ...pageProps('works'), verification }} />);
  const values = [...html.matchAll(/<div class="v tnum">([^<]*)<\/div>/g)].map((m) => m[1]!);
  return { html, count: values[1]! };
}

describe('通常の Git 配備で、表示と根拠が一致する', () => {
  it('Vercel の Git 配備（npm run validate は静的検査だけ）では、件数を「—」にする', () => {
    verifyWrites('vercel', 'verify-report.static.json', { kind: 'static' });
    const options = {
      reportPath: join(root, 'vercel', 'verify-report.json'),
      env: { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: SHA },
      git: noGit,
    };
    expect(readVerification(options)).toEqual({ ok: false, reason: 'missing' });
    const { html, count } = renderWorks(verifiedSummary(options));
    expect(count.startsWith('—')).toBe(true);
    expect(html).toContain(copy.unverifiedNote);
  });

  it('Vercel のビルドに全項目のレポートが紛れ込んでも、未コミットの変更を確かめられないので採用しない', () => {
    verifyWrites('vercel-copied', 'verify-report.json');
    const options = {
      reportPath: join(root, 'vercel-copied', 'verify-report.json'),
      env: { VERCEL_GIT_COMMIT_SHA: SHA },
      git: noGit,
    };
    expect(readVerification(options)).toEqual({ ok: false, reason: 'uncommitted-changes' });
    expect(renderWorks(verifiedSummary(options)).count.startsWith('—')).toBe(true);
  });

  it('静的検査の結果を全項目の置き場所に置いても、件数に使わない', () => {
    verifyWrites('renamed', 'verify-report.json', { kind: 'static' });
    const options = { reportPath: join(root, 'renamed', 'verify-report.json'), env: {}, git: cleanCheckout(SHA) };
    expect(readVerification(options)).toEqual({ ok: false, reason: 'static-only' });
  });

  it('同じコミットのきれいなチェックアウトで全項目 FAIL 0 なら、レポートと同じ件数・日付・コミットを出す', () => {
    const report = verifyWrites('checkout', 'verify-report.json');
    const summary = verifiedSummary({
      reportPath: join(root, 'checkout', 'verify-report.json'),
      env: { GITHUB_SHA: SHA },
      git: cleanCheckout(SHA),
    });
    expect(summary).toEqual({ pass: 3, warn: 1, measuredOn: '2026-09-16', commit: '1234567' });
    const { html, count } = renderWorks(summary);
    expect(count).toBe(`${report.counts.pass} 項目`);
    expect(html).toContain('1234567');
    expect(html).toContain('2026-09-16');
    expect(html).not.toContain(copy.unverifiedNote);
  });

  it.each([
    ['前のコミットで測ったレポート', { sha: PREVIOUS }, cleanCheckout(SHA)],
    ['FAIL を含むレポート', { results: [...passing, { level: 'FAIL', check: '13 LCP 2.5秒以内', page: 'index.html', detail: '' } as Result] }, cleanCheckout(SHA)],
    ['未コミットの変更がある状態で測ったレポート', { dirty: true }, cleanCheckout(SHA)],
    ['未コミットの変更があるビルド', {}, ((args: string[]) => (args[0] === 'rev-parse' ? SHA : ' M src/views/works.tsx')) as GitRunner],
  ] as const)('%s の件数は出さない', (_, input, git) => {
    const dir = `case-${Math.random().toString(36).slice(2)}`;
    verifyWrites(dir, 'verify-report.json', input as Parameters<typeof verifyWrites>[2]);
    const summary = verifiedSummary({ reportPath: join(root, dir, 'verify-report.json'), env: {}, git });
    expect(summary).toBeNull();
    expect(renderWorks(summary).count.startsWith('—')).toBe(true);
  });

  it('表示速度は固定の記録なので、測った日を添えて出す（ビルドごとの実測に見せない）', () => {
    const works = renderWorks(null).html;
    const spec = renderToStaticMarkup(<Page {...pageProps('spec')} />);
    expect(works).toContain(LCP_RECORDED_ON);
    expect(spec).toContain(LCP_RECORDED_ON);
  });
});
