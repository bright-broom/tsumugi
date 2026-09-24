import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  alertBody,
  checkWatchdog,
  type Alert,
  type WorkflowRun,
  type WatchdogReport,
} from '../tools/ops/watchdog';

const ROOT = join(import.meta.dirname, '..');
const NOW = new Date('2026-09-24T12:00:00Z');
const options = { maxAgeMinutes: 180, stepName: 'Monitor', now: NOW };

let id = 0;
const run = (over: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: (id += 1),
  status: 'completed',
  conclusion: 'success',
  createdAt: '2026-09-24T11:17:00Z',
  url: `https://github.com/example/tsumugi/actions/runs/${id}`,
  ...over,
});
const ok = (over: Partial<WorkflowRun> = {}) =>
  run({ steps: [{ name: 'Monitor', conclusion: 'success' }], ...over });
const levels = (report: WatchdogReport) =>
  report.results.map((entry) => `${entry.status} ${entry.name}`);

describe('監視の見張り', () => {
  it('毎時の実行が新しく、中身も走っていれば正常', () => {
    const report = checkWatchdog([ok(), ok(), ok()], options);
    expect(levels(report)).toEqual(['PASS 監視の実行', 'PASS 監視の中身', 'PASS 直近の結果']);
    expect(report.alert).toBe<Alert>('none');
    expect(report.headline).toContain('監視は正常です');
  });

  it('一度も実行されていない／完了した実行がないことを、止まっていると見なす', () => {
    const never = checkWatchdog([], options);
    expect(never.alert).toBe<Alert>('down');
    expect(never.results[0]?.detail).toContain('一度も実行されていません');
    const running = checkWatchdog([run({ status: 'in_progress', conclusion: null })], options);
    expect(running.alert).toBe<Alert>('down');
    expect(running.results[0]?.detail).toContain('完了した実行がありません');
  });

  it('直近の実行が古ければ、成功していても監視が止まっていると出す', () => {
    const report = checkWatchdog([ok({ createdAt: '2026-09-24T03:00:00Z' })], options);
    expect(report.results[0]).toMatchObject({ status: 'FAIL', name: '監視の実行' });
    expect(report.results[0]?.detail).toContain('9 時間前');
    expect(report.results[0]?.detail).toContain('監視が止まっています');
    expect(report.alert).toBe<Alert>('down');
  });

  it('成功と表示されていても、監視の手順が飛ばされていれば失敗にする', () => {
    // 2026-09-18 の監査で実際に起きた状態（依存導入以降の全ステップが skipped）。
    const skipped = checkWatchdog(
      [run({ steps: [{ name: 'Monitor', conclusion: 'skipped' }] })],
      options,
    );
    expect(skipped.results[1]).toMatchObject({ status: 'FAIL', name: '監視の中身' });
    expect(skipped.alert).toBe<Alert>('down');
    const renamed = checkWatchdog(
      [run({ steps: [{ name: 'Check', conclusion: 'success' }] })],
      options,
    );
    expect(renamed.results[1]?.detail).toContain('実行に含まれていません');
    // 手順の結果を取っていないときは、分からないものを合格にしない。
    expect(checkWatchdog([run()], options).results[1]).toMatchObject({ status: 'SKIP' });
  });

  it('失敗と連続の失敗を出す', () => {
    const once = checkWatchdog([ok({ conclusion: 'failure' }), ok()], options);
    expect(levels(once)).toContain('FAIL 直近の結果');
    expect(levels(once)).not.toContain('FAIL 連続の失敗');
    const twice = checkWatchdog(
      [ok({ conclusion: 'failure' }), ok({ conclusion: 'timed_out' }), ok()],
      options,
    );
    expect(twice.results.at(-1)).toMatchObject({ status: 'FAIL', name: '連続の失敗' });
    expect(twice.results.at(-1)?.detail).toContain('直近 2 回');
    expect(twice.headline).toContain('failure');
  });

  it('失敗のあとの成功を復旧として知らせる', () => {
    const report = checkWatchdog([ok(), ok({ conclusion: 'failure' }), ok()], options);
    expect(report.alert).toBe<Alert>('recovered');
    expect(report.results.at(-1)).toMatchObject({ status: 'PASS', name: '復旧' });
    expect(report.headline).toContain('復旧しました');
    // 失敗が残っている間は復旧にしない。
    expect(checkWatchdog([ok({ conclusion: 'failure' }), ok()], options).alert).toBe<Alert>('down');
  });

  it('通知の本文は、結果の表と次の手を含む', () => {
    const down = checkWatchdog([ok({ conclusion: 'failure' })], options);
    const body = alertBody(down, { workflow: 'site-monitor.yml', target: 'https://example.jp' });
    expect(body).toContain('site-monitor.yml');
    expect(body).toContain('https://example.jp');
    expect(body).toContain('| FAIL | 直近の結果 |');
    expect(body).toContain('対応：');
    const recovered = checkWatchdog([ok(), ok({ conclusion: 'failure' })], options);
    expect(alertBody(recovered, { workflow: 'w', target: 't' })).toContain('自動で閉じます');
  });
});

describe('watchdog コマンド', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const cli = (runs: WorkflowRun[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'tsumugi-watchdog-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'runs.json'), JSON.stringify(runs));
    const output = join(dir, 'output.txt');
    writeFileSync(output, '');
    const result = spawnSync(
      'node',
      [
        '--import',
        'tsx',
        join(ROOT, 'tools/ops/cli/watchdog.ts'),
        '--runs',
        join(dir, 'runs.json'),
        '--json',
        join(dir, 'watchdog.json'),
        '--body',
        join(dir, 'body.md'),
      ],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output } },
    );
    return { ...result, dir, output: readFileSync(output, 'utf8') };
  };

  it('正常なら終了コード 0、通知は none', () => {
    const result = cli([ok(), ok()]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('通知: none');
    expect(result.output).toContain('alert=none');
    expect(JSON.parse(readFileSync(join(result.dir, 'watchdog.json'), 'utf8'))).toMatchObject({
      counts: { FAIL: 0 },
    });
  });

  it('止まっていれば終了コード 1、通知は down、本文を書き出す', () => {
    const result = cli([ok({ createdAt: '2026-01-01T00:00:00Z' })]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('alert=down');
    expect(readFileSync(join(result.dir, 'body.md'), 'utf8')).toContain('監視が止まっています');
  });

  it('復旧は終了コード 0 で、通知だけ recovered にする', () => {
    const result = cli([ok(), ok({ conclusion: 'failure' })]);
    expect(result.status).toBe(0);
    expect(result.output).toContain('alert=recovered');
  });

  it('実行履歴を取れない指定は、使い方を出して終了コード 2', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx', join(ROOT, 'tools/ops/cli/watchdog.ts'), '--repo', ''],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: '', GH_TOKEN: '', GITHUB_TOKEN: '' } },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--repo owner/name');
  });
});
