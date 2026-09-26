/**
 * 監視そのものの見張り（監査 A07、ADR 0083）。
 *
 *     npm run watchdog                                    GitHub の実行履歴を見る（GH_TOKEN が要る）
 *     npm run watchdog -- --runs <実行履歴.json>          通信せずに判定を試す
 *     npm run watchdog -- --max-age-minutes 720 --json <file>
 *
 * FAIL が1件でもあれば終了コード 1。ワークフローはこの結果で issue を立て、復旧したら閉じる。
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from '../../paths';
import { report } from '../results';
import { monitorTarget } from '../site-expectations';
import { alertBody, checkWatchdog, DEFAULT_MAX_AGE_MINUTES, type WorkflowRun } from '../watchdog';
import { nonNegativeInteger } from './options';

const USAGE =
  '使い方: npm run watchdog -- [--repo owner/name] [--workflow site-monitor.yml] [--max-age-minutes 720] [--step Monitor] [--limit 10] [--runs <file>] [--json <file>] [--body <file>]';

const { values } = parseArgs({
  options: {
    repo: { type: 'string', default: process.env.GITHUB_REPOSITORY ?? '' },
    workflow: { type: 'string', default: 'site-monitor.yml' },
    step: { type: 'string', default: 'Monitor' },
    'max-age-minutes': { type: 'string', default: String(DEFAULT_MAX_AGE_MINUTES) },
    limit: { type: 'string', default: '10' },
    runs: { type: 'string' },
    json: { type: 'string', default: join(ROOT, '.artifacts', 'ops', 'watchdog.json') },
    body: { type: 'string', default: join(ROOT, '.artifacts', 'ops', 'watchdog-body.md') },
  },
});

const api = async (path: string): Promise<unknown> => {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token)
    throw new Error(
      '実行履歴を読むには GH_TOKEN（または GITHUB_TOKEN）が要ります。手元で試すときは --runs <file> を使ってください',
    );
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'tsumugi-watchdog',
    },
  });
  if (!response.ok) throw new Error(`GitHub の API が ${response.status} を返しました: ${path}`);
  return response.json();
};

/** 実行履歴。--runs があればそれを読み、なければ GitHub から取る。 */
async function loadRuns(): Promise<WorkflowRun[]> {
  if (values.runs) return JSON.parse(readFileSync(values.runs, 'utf8')) as WorkflowRun[];
  if (!values.repo)
    throw new Error('--repo owner/name を指定してください（GitHub Actions では自動で入ります）');
  const limit = nonNegativeInteger(values.limit, '--limit');
  const listed = (await api(
    `/repos/${values.repo}/actions/workflows/${values.workflow}/runs?per_page=${limit}`,
  )) as {
    workflow_runs?: {
      id: number;
      status: string;
      conclusion: string | null;
      created_at: string;
      html_url: string;
    }[];
  };
  const runs: WorkflowRun[] = (listed.workflow_runs ?? []).map((run) => ({
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    url: run.html_url,
  }));
  const latest = runs.find((run) => run.status === 'completed');
  if (latest) {
    const jobs = (await api(`/repos/${values.repo}/actions/runs/${latest.id}/jobs`)) as {
      jobs?: { steps?: { name: string; conclusion: string | null }[] }[];
    };
    latest.steps = (jobs.jobs ?? []).flatMap((job) => job.steps ?? []);
  }
  return runs;
}

try {
  const startedAt = new Date();
  const runs = await loadRuns();
  const watchdog = checkWatchdog(runs, {
    maxAgeMinutes: nonNegativeInteger(values['max-age-minutes'], '--max-age-minutes'),
    stepName: values.step,
    now: startedAt,
  });
  // 監視先は、監視と同じ決め方（SITE_URL → 自社公開判断の DOMAIN）。読めないときは通知の本文だけ省く。
  let target = '（監視先の設定を読めませんでした）';
  try {
    target = monitorTarget(process.env.SITE_URL ?? '').origin;
  } catch {
    // 監視先が決まっていないこと自体は Site monitor 側が失敗として知らせる
  }
  const body = alertBody(watchdog, { workflow: values.workflow, target });
  mkdirSync(dirname(values.body), { recursive: true });
  writeFileSync(values.body, `${body}\n`);
  const code = report('監視の見張り', watchdog.results, {
    target: `${values.repo || values.runs} / ${values.workflow}`,
    startedAt,
    json: values.json,
  });
  console.log(`通知: ${watchdog.alert}（本文: ${values.body}）`);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `alert=${watchdog.alert}\nheadline=${watchdog.headline.replace(/\r?\n/g, ' ')}\nbody=${values.body}\n`,
    );
  process.exitCode = code;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(USAGE);
  process.exitCode = 2;
}
