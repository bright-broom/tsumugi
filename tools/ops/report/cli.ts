/** npm run ops:report -- <command>。使い方は tools/ops/README.md。 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCustomerMetrics, summarizeMonth } from '../metrics/model';
import { loadRequests } from '../requests/model';
import { type Args, readText, runCli, sha256 } from '../shared/cli';
import { renderHtml, renderMarkdown } from '../shared/document';
import {
  OpsError,
  parseId,
  readJson,
  readJsonIfExists,
  resolveDataDir,
  writeJson,
  writeText,
} from '../shared/store';
import { now, parseDate, parseMonth, shiftMonth, today } from '../shared/time';
import { approvalSchema, approvalStatus, buildMonthlyReport, gbpPerformanceSchema } from './model';

const USAGE = `
npm run ops:report -- generate --customer <顧客ID> --month YYYY-MM [--label <宛名>] [--plan <継続支援のキー>] [--note <対応事項>]... [--format md|html]
npm run ops:report -- approve  --customer <顧客ID> --month YYYY-MM --by <確認者> [--format md|html]
npm run ops:report -- status   --customer <顧客ID> --month YYYY-MM [--format md|html]
共通: [--data <データの置き場所>] [--today YYYY-MM-DD]
GBP の実績は <データの置き場所>/gbp/<顧客ID>/performance/<YYYY-MM>.json に手で入力する。
ツールは送信・共有をしない。確認後の書面は人が渡す。
`;

const context = (args: Args) => {
  const dataDir = resolveDataDir(args.optional('data'));
  const customerId = parseId(args.required('customer'), '--customer');
  const month = parseMonth(args.required('month'), '--month');
  const format = args.optional('format') ?? 'md';
  if (format !== 'md' && format !== 'html') throw new OpsError('--format は md か html');
  const dir = join(dataDir, 'reports', customerId);
  return {
    dataDir,
    customerId,
    month,
    format,
    draftPath: join(dir, `${month}.draft.${format}`),
    approvalPath: join(dir, `${month}.approval.json`),
  };
};

runCli(USAGE, {
  generate(args) {
    const c = context(args);
    const { sources, imports } = loadCustomerMetrics(c.dataDir, c.customerId);
    const gbp = (month: string) =>
      readJsonIfExists(
        join(c.dataDir, 'gbp', c.customerId, 'performance', `${month}.json`),
        gbpPerformanceSchema,
      );
    const plan = args.optional('plan');
    const { document, actions } = buildMonthlyReport({
      customerId: c.customerId,
      customerLabel: args.optional('label') ?? c.customerId,
      month: c.month,
      generatedAt: now(),
      today: parseDate(args.optional('today') ?? today(), '--today'),
      metrics: summarizeMonth(c.customerId, c.month, sources, imports),
      previousMetrics: summarizeMonth(c.customerId, shiftMonth(c.month, -1), sources, imports),
      requests: loadRequests(c.dataDir, c.customerId),
      gbp: gbp(c.month),
      previousGbp: gbp(shiftMonth(c.month, -1)),
      plan: plan ?? null,
      notes: args.list('note'),
    });
    writeText(c.draftPath, c.format === 'md' ? renderMarkdown(document) : renderHtml(document));
    console.log(`${c.draftPath} に下書きを書き出しました（対応事項 ${actions.length} 件）`);
    if (existsSync(c.approvalPath))
      console.log('注意: 以前の確認の記録があります。作り直した下書きは確認を取り直してください');
  },
  approve(args) {
    const c = context(args);
    if (!existsSync(c.draftPath)) throw new OpsError(`下書きがありません: ${c.draftPath}`);
    writeJson(c.approvalPath, {
      customerId: c.customerId,
      month: c.month,
      draftFile: c.draftPath,
      draftSha256: sha256(readText(c.draftPath)),
      approvedBy: args.required('by'),
      approvedAt: now(),
    });
    console.log('確認の記録を保存しました（送信・共有はしていません）');
  },
  status(args) {
    const c = context(args);
    if (!existsSync(c.draftPath)) throw new OpsError(`下書きがありません: ${c.draftPath}`);
    const approval = existsSync(c.approvalPath) ? readJson(c.approvalPath, approvalSchema) : null;
    const status = approvalStatus(readText(c.draftPath), approval);
    console.log(
      {
        unapproved: '未確認',
        approved: `確認済み（${approval?.approvedBy}、${approval?.approvedAt}）`,
        stale: '確認後に下書きが変わっています。確認を取り直してください',
      }[status],
    );
  },
});
