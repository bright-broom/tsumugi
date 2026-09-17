import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRelease } from '../tools/ops/release';
import { distFetch, type Fetch } from '../tools/ops/probe';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'release-check-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<h1>current</h1>');
  writeFileSync(join(dir, '404.html'), '<h1>not found</h1>');
  writeFileSync(join(dir, 'theme.css'), 'body{color:red}');
  writeFileSync(join(dir, 'assets', 'image.png'), Buffer.from([0, 255, 128, 32]));
  return dir;
}
const origin = 'https://example.jp';
const failures = (r: Awaited<ReturnType<typeof checkRelease>>) =>
  r.filter((x) => x.status === 'FAIL');

describe('公開成果物の一致検査', () => {
  it('HTML・CSS・バイナリ画像とトップの別URLを照合する', async () => {
    const dir = fixture();
    const r = await checkRelease(origin, dir, { fetch: distFetch(dir) });
    expect(r).toHaveLength(6);
    expect(failures(r)).toEqual([]);
    expect(r.map((x) => x.name)).toContain('/');
    expect(r.find((x) => x.name === '/assets/image.png')?.detail).toContain('4 bytes');
  });

  it('同じ長さの旧HTML・CSSと欠けた画像を別々に検出する', async () => {
    const expected = fixture(),
      served = fixture();
    writeFileSync(join(served, 'index.html'), '<h1>old one</h1>');
    writeFileSync(join(served, 'theme.css'), 'body{color:tan}');
    rmSync(join(served, 'assets', 'image.png'));
    const r = await checkRelease(origin, expected, { fetch: distFetch(served) });
    expect(
      failures(r)
        .map((x) => x.name)
        .sort(),
    ).toEqual(['/', '/assets/image.png', '/index.html', '/theme.css']);
  });

  it('404ページだけはHTTP404でも内容が一致すれば合格する', async () => {
    const dir = fixture();
    const base = distFetch(dir);
    const fetch: Fetch = async (url) =>
      url.endsWith('/404.html') ? new Response('<h1>not found</h1>', { status: 404 }) : base(url);
    expect(failures(await checkRelease(origin, dir, { fetch }))).toEqual([]);
  });

  it('転送は追跡せず、同じ本文でも通常ページのHTTPエラーを拒否する', async () => {
    const dir = fixture();
    const calls: string[] = [];
    const fetch: Fetch = async (url, init) => {
      calls.push(url);
      expect(init?.redirect).toBe('manual');
      expect(init?.signal).toBeTruthy();
      return new Response('<h1>current</h1>', {
        status: url.endsWith('index.html') ? 404 : 302,
        headers: { location: 'https://other.example/' },
      });
    };
    const r = await checkRelease(origin, dir, { fetch });
    expect(failures(r)).toHaveLength(5);
    expect(calls.every((url) => new URL(url).origin === origin)).toBe(true);
  });

  it('転送される本文が大きすぎたら読み続けない', async () => {
    const dir = fixture();
    let cancelled = 0;
    const fetch: Fetch = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull(c) {
            c.enqueue(new Uint8Array(100));
          },
          cancel() {
            cancelled++;
          },
        }),
      );
    const r = await checkRelease(origin, dir, { fetch });
    expect(failures(r)).toHaveLength(5);
    expect(cancelled).toBe(5);
    expect(failures(r).every((x) => x.detail.includes('超えています'))).toBe(true);
  });

  it('一部の通信失敗でも残りを検査し、同時接続を4以下に抑える', async () => {
    const dir = fixture();
    let active = 0,
      maximum = 0;
    const base = distFetch(dir);
    const fetch: Fetch = async (url) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      if (url.endsWith('/theme.css')) throw new Error('connection failed');
      return base(url);
    };
    const r = await checkRelease(origin, dir, { fetch });
    expect(maximum).toBe(4);
    expect(failures(r).map((x) => x.name)).toEqual(['/theme.css']);
  });

  it('比較元の指紋を保存し、別の比較元なら通信前に停止する', async () => {
    const dir = fixture();
    const first = await checkRelease(origin, dir, { fetch: distFetch(dir) });
    const fingerprint = first[0]!.detail.split('（')[0]!;
    expect(
      failures(
        await checkRelease(origin, dir, {
          fetch: distFetch(dir),
          expectedFingerprint: fingerprint,
        }),
      ),
    ).toEqual([]);
    writeFileSync(join(dir, 'theme.css'), 'changed');
    let calls = 0;
    await expect(
      checkRelease(origin, dir, {
        expectedFingerprint: fingerprint,
        fetch: async () => {
          calls++;
          return new Response('');
        },
      }),
    ).rejects.toThrow('指紋');
    expect(calls).toBe(0);
  });

  it.each(['hidden', 'link', 'missing-index'])(
    '不適切な比較元 %s は通信前に拒否する',
    async (kind) => {
      const dir = fixture();
      if (kind === 'hidden') writeFileSync(join(dir, '.env'), 'not public');
      if (kind === 'link') symlinkSync(join(dir, 'index.html'), join(dir, 'linked.html'));
      if (kind === 'missing-index') rmSync(join(dir, 'index.html'));
      let calls = 0;
      await expect(
        checkRelease(origin, dir, {
          fetch: async () => {
            calls++;
            return new Response('');
          },
        }),
      ).rejects.toThrow();
      expect(calls).toBe(0);
    },
  );
});

it('CLIは一致0・内容不一致1・比較元の取り違え2で終了し、模擬配信と明示する', () => {
  const expected = fixture(),
    served = fixture();
  const reportDir = mkdtempSync(join(tmpdir(), 'release-report-'));
  dirs.push(reportDir);
  const report = join(reportDir, 'check.json');
  const args = [
    '--import',
    'tsx',
    'tools/ops/cli/check-release.ts',
    '--url',
    origin,
    '--dist',
    expected,
    '--served-dist',
    served,
    '--json',
    report,
  ];
  const run = (...extra: string[]) =>
    spawnSync(process.execPath, [...args, ...extra], { encoding: 'utf8' });
  expect(run().status).toBe(0);
  const initial = JSON.parse(readFileSync(report, 'utf8'));
  expect(initial.title).toContain('模擬配信・通信なし');
  expect(initial.counts).toMatchObject({ PASS: 6, FAIL: 0 });
  writeFileSync(join(served, 'theme.css'), 'wrong');
  expect(run().status).toBe(1);
  expect(JSON.parse(readFileSync(report, 'utf8')).counts.FAIL).toBe(1);
  expect(run('--fingerprint', 'wrong').status).toBe(2);
});
