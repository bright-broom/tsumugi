/**
 * 監視そのものの見張り（監査 A07、ADR 0046 の続き）。
 *
 * 監視（Site monitor、cron は毎時）は、失敗するとジョブが失敗して通知が届く。
 * しかし「動いていない」「成功と表示されているが中身が飛ばされている」「直ってもそれが伝わらない」は、
 * 監視の結果を見ているだけでは分からない。ここでは実行の履歴そのものを検査する。
 *
 * 判定はこの純粋関数に置き、GitHub との通信と通知は cli/watchdog.ts とワークフローが行う。
 */
import { result, type CheckResult } from './results';

export interface WorkflowRun {
  id: number;
  /** queued・in_progress・completed */
  status: string;
  /** success・failure・cancelled・timed_out・skipped・null（未完了） */
  conclusion: string | null;
  createdAt: string;
  url: string;
  /** 最新の実行だけ。監視の手順が実際に走ったかを見る。 */
  steps?: readonly { name: string; conclusion: string | null }[];
}

export interface WatchdogOptions {
  /** この分数より古い実行しかなければ、監視は止まっているとみなす。 */
  maxAgeMinutes: number;
  /** 監視の中身にあたる手順の名前（この手順が飛ばされていたら、成功と表示されていても失敗）。 */
  stepName: string;
  now: Date;
}

/** 通知の種類。down は障害の起票、recovered は復旧の連絡。 */
export type Alert = 'down' | 'recovered' | 'none';

export interface WatchdogReport {
  results: CheckResult[];
  alert: Alert;
  /** 起票・連絡の本文に使う一行。 */
  headline: string;
}

/**
 * 既定の「止まっている」とみなす経過時間。
 *
 * Site monitor の cron は毎時（`17 * * * *`）だが、GitHub Actions の schedule は混雑時に遅れ・間引かれる。
 * 2026-09-19〜26 の実測では、実行の間隔は 2.4〜6.3 時間（約 60 回、すべて成功）で、毎時には一度も届いていない。
 * 180 分の閾値では正常な運用でも警報が出続けた（#101）。実測の最大の約 2 倍の 12 時間を既定にする。
 * 見張り自体は 6 時間ごとに動くので、本当に止まった場合も最長で約 18 時間で気づける。
 */
export const DEFAULT_MAX_AGE_MINUTES = 12 * 60;

const COMPLETED = 'completed';
const minutesBetween = (from: string, to: Date) =>
  Math.round((to.getTime() - new Date(from).getTime()) / 60_000);

const age = (minutes: number) =>
  minutes < 120 ? `${minutes} 分前` : `${Math.floor(minutes / 60)} 時間前`;

export function checkWatchdog(
  runs: readonly WorkflowRun[],
  options: WatchdogOptions,
): WatchdogReport {
  const results: CheckResult[] = [];
  const completed = runs.filter((run) => run.status === COMPLETED);
  const latest = completed[0];

  if (!latest) {
    results.push(
      result(
        'FAIL',
        '監視の実行',
        runs.length
          ? '完了した実行がありません（実行中だけ）。次の実行の完了を待って再確認してください'
          : '一度も実行されていません。ワークフローの有効化と cron の設定を確認してください',
      ),
    );
    return { results, alert: 'down', headline: '監視が一度も完了していません' };
  }

  const minutes = minutesBetween(latest.createdAt, options.now);
  const stale = minutes > options.maxAgeMinutes;
  results.push(
    result(
      stale ? 'FAIL' : 'PASS',
      '監視の実行',
      `直近の実行は ${age(minutes)}（${latest.createdAt}）${
        stale ? `。${options.maxAgeMinutes} 分より古いため、監視が止まっています` : ''
      }`,
    ),
  );

  // 「成功」でも中身が飛ばされていることがある（2026-09-18 の監査で実際に起きた）。
  if (latest.steps === undefined) {
    results.push(result('SKIP', '監視の中身', '手順の結果を取得していません'));
  } else {
    const step = latest.steps.find((entry) => entry.name === options.stepName);
    if (!step)
      results.push(
        result('FAIL', '監視の中身', `手順「${options.stepName}」が実行に含まれていません`),
      );
    else if (step.conclusion === 'skipped')
      results.push(
        result(
          'FAIL',
          '監視の中身',
          `手順「${options.stepName}」が飛ばされています（実行は成功と表示されます）`,
        ),
      );
    else
      results.push(
        result('PASS', '監視の中身', `手順「${options.stepName}」は ${step.conclusion}`),
      );
  }

  const failed = (run: WorkflowRun) => run.conclusion !== 'success';
  results.push(
    result(
      failed(latest) ? 'FAIL' : 'PASS',
      '直近の結果',
      `${latest.conclusion ?? '不明'}（${latest.url}）`,
    ),
  );

  let streak = 0;
  while (streak < completed.length && failed(completed[streak]!)) streak += 1;
  if (streak >= 2)
    results.push(result('FAIL', '連続の失敗', `直近 ${streak} 回続けて失敗しています`));

  const recovered = !failed(latest) && completed[1] !== undefined && failed(completed[1]);
  if (recovered)
    results.push(
      result(
        'PASS',
        '復旧',
        `前回の失敗（${completed[1]!.conclusion ?? '不明'}）から復旧しました（${latest.url}）`,
      ),
    );

  const down = results.some((entry) => entry.status === 'FAIL');
  return {
    results,
    alert: down ? 'down' : recovered ? 'recovered' : 'none',
    headline: down
      ? (results.find((entry) => entry.status === 'FAIL')?.detail ?? '監視に問題があります')
      : recovered
        ? `監視が復旧しました（${latest.url}）`
        : `監視は正常です（直近の実行は ${age(minutes)}）`,
  };
}

/** 実行そのものが止まっている（中身の失敗ではない）とき。対応の手順が違う。 */
const stale = (report: WatchdogReport) =>
  report.results.some((entry) => entry.name === '監視の実行' && entry.status === 'FAIL');

/** 起票・復旧連絡の本文。受け取った人がそのまま次の手を取れる内容にする。 */
export function alertBody(report: WatchdogReport, context: { workflow: string; target: string }) {
  const lines = [
    report.headline,
    '',
    `- 監視のワークフロー: ${context.workflow}`,
    `- 監視先: ${context.target}`,
    '',
    '| 結果 | 項目 | 内容 |',
    '|---|---|---|',
    ...report.results.map(
      (entry) => `| ${entry.status} | ${entry.name} | ${entry.detail.replaceAll('|', '\\|')} |`,
    ),
    '',
    ...(report.alert !== 'down'
      ? ['復旧を確認しました。この issue は自動で閉じます。']
      : stale(report)
        ? [
            '対応：監視のワークフローが動いていません。Actions の画面でワークフローが無効になっていないか（60 日間リポジトリに動きがないと GitHub が schedule を止めます）、ワークフローのファイルが壊れていないかを確認し、手動で実行（Run workflow）して結果を見てください。',
          ]
        : [
            '対応：ワークフローの実行履歴を開き、失敗の内容（死活・証明書・robots・sitemap・応答時間）を確認してください。サイトが実際に落ちている場合は、配信元の状態と直近の配備を確認します。',
          ]),
  ];
  return lines.join('\n');
}
