/** npm run ops:requests -- <command>。使い方は tools/ops/README.md。 */
import { type Args, runCli } from '../shared/cli';
import { OpsError, parseId, resolveDataDir, writeJson } from '../shared/store';
import { jstDate, now, parseDate, parseMonth, today, timestampSchema } from '../shared/time';
import {
  STATUS_LABELS,
  type RequestsFile,
  addRequest,
  allowanceFor,
  assignRequest,
  loadRequests,
  logWork,
  monthlyWork,
  moveRequest,
  openRequests,
  recordCompletionNotice,
  requestsPath,
  threeMonthAverage,
} from './model';

const USAGE = `
npm run ops:requests -- init   --customer <顧客ID> --since YYYY-MM-DD
npm run ops:requests -- add    --customer <顧客ID> --url <URL> --description <内容> --channel <受付経路> --by <記録者>
                               [--selector <CSS セレクター>] [--x <px> --y <px> [--viewport <幅px>]] [--location-note <位置の説明>]
                               [--attach <添付の保管場所>]... [--assignee <担当>] [--due YYYY-MM-DD] [--at <受付日時>]
npm run ops:requests -- move   --customer <顧客ID> --id <依頼ID> --to in_progress|awaiting_review|done --by <記録者> [--note]
npm run ops:requests -- assign --customer <顧客ID> --id <依頼ID> [--assignee <担当>] [--due YYYY-MM-DD]
npm run ops:requests -- log    --customer <顧客ID> --id <依頼ID> --minutes <分> --kind change|warranty --by <作業者> [--date YYYY-MM-DD] [--note]
npm run ops:requests -- notice --customer <顧客ID> --id <依頼ID> --channel <連絡手段> --by <記録者> [--note]
npm run ops:requests -- list   --customer <顧客ID> [--today YYYY-MM-DD]
npm run ops:requests -- hours  --customer <顧客ID> --month YYYY-MM [--plan <継続支援のキー>]
共通: [--data <データの置き場所>]
完了連絡は記録だけで、ツールからは送信しない。
`;

const open = (args: Args) => {
  const dataDir = resolveDataDir(args.optional('data'));
  const customerId = parseId(args.required('customer'), '--customer');
  const file = loadRequests(dataDir, customerId);
  if (!file) throw new OpsError(`依頼の記録がありません。先に init してください: ${customerId}`);
  const save = (next: RequestsFile) => writeJson(requestsPath(dataDir, customerId), next);
  return { file, save };
};
const at = (args: Args) => {
  const value = args.optional('at') ?? now();
  if (!timestampSchema.safeParse(value).success)
    throw new OpsError('--at はタイムゾーン付きの日時');
  return value;
};
const optionalInt = (args: Args, name: string) =>
  args.optional(name) === undefined ? undefined : args.integer(name);

runCli(USAGE, {
  init(args) {
    const dataDir = resolveDataDir(args.optional('data'));
    const customerId = parseId(args.required('customer'), '--customer');
    if (loadRequests(dataDir, customerId)) throw new OpsError('既に記録があります');
    const path = requestsPath(dataDir, customerId);
    writeJson(path, {
      customerId,
      trackingSince: parseDate(args.required('since'), '--since'),
      requests: [],
    });
    console.log(`${path} を作りました`);
  },
  add(args) {
    const { file, save } = open(args);
    const x = optionalInt(args, 'x');
    const y = optionalInt(args, 'y');
    const viewportWidth = optionalInt(args, 'viewport');
    const due = args.optional('due');
    const { file: next, id } = addRequest(file, {
      receivedAt: at(args),
      channel: args.required('channel'),
      url: args.required('url'),
      location: {
        ...(args.optional('selector') ? { selector: args.required('selector') } : {}),
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
        ...(viewportWidth !== undefined ? { viewportWidth } : {}),
        ...(args.optional('location-note') ? { note: args.required('location-note') } : {}),
      },
      description: args.required('description'),
      attachments: args.list('attach').map((ref) => ({ ref })),
      ...(args.optional('assignee') ? { assignee: args.required('assignee') } : {}),
      ...(due ? { dueOn: parseDate(due, '--due') } : {}),
      by: args.required('by'),
    });
    save(next);
    console.log(`${id} を受け付けました`);
  },
  move(args) {
    const { file, save } = open(args);
    const id = args.required('id');
    const note = args.optional('note');
    save(
      moveRequest(file, id, args.required('to'), {
        at: at(args),
        by: args.required('by'),
        ...(note ? { note } : {}),
      }),
    );
    console.log(`${id} を ${args.required('to')} にしました`);
  },
  assign(args) {
    const { file, save } = open(args);
    const due = args.optional('due');
    const assignee = args.optional('assignee');
    if (!due && !assignee) throw new OpsError('--assignee か --due を指定してください');
    save(
      assignRequest(file, args.required('id'), {
        ...(assignee ? { assignee } : {}),
        ...(due ? { dueOn: parseDate(due, '--due') } : {}),
      }),
    );
    console.log('担当・期限を更新しました');
  },
  log(args) {
    const { file, save } = open(args);
    const note = args.optional('note');
    save(
      logWork(file, args.required('id'), {
        date: parseDate(args.optional('date') ?? jstDate(now()), '--date'),
        minutes: args.integer('minutes'),
        kind: args.required('kind'),
        by: args.required('by'),
        ...(note ? { note } : {}),
      }),
    );
    console.log('作業時間を記録しました');
  },
  notice(args) {
    const { file, save } = open(args);
    const note = args.optional('note');
    save(
      recordCompletionNotice(file, args.required('id'), {
        recordedAt: at(args),
        by: args.required('by'),
        channel: args.required('channel'),
        ...(note ? { note } : {}),
      }),
    );
    console.log('完了連絡を記録しました（送信はしていません）');
  },
  list(args) {
    const { file } = open(args);
    const day = parseDate(args.optional('today') ?? today(), '--today');
    const overdue = new Set(
      openRequests(file, day)
        .filter((o) => o.overdue)
        .map((o) => o.request.id),
    );
    for (const r of file.requests)
      console.log(
        [
          r.id,
          STATUS_LABELS[r.status],
          r.assignee ?? '担当未定',
          r.dueOn ? `期限 ${r.dueOn}${overdue.has(r.id) ? '（超過）' : ''}` : '期限なし',
          r.url,
          r.description,
        ].join('\t'),
      );
  },
  hours(args) {
    const { file } = open(args);
    const month = parseMonth(args.required('month'), '--month');
    const work = monthlyWork(file, month);
    const average = threeMonthAverage(file, month);
    if (!work.tracked) {
      console.log(`${month} は記録開始（${file.trackingSince}）より前です（未記録）`);
      return;
    }
    for (const r of work.byRequest)
      console.log(
        `${r.id}\t実作業 ${r.minutes}分／通常変更 ${r.changeMinutes}分／無償修補 ${r.warrantyMinutes}分／未分類 ${r.unclassifiedMinutes}分\t${r.description}`,
      );
    console.log(
      `実作業 ${work.rawMinutes}分／通常変更 ${work.changeMinutes}分／無償修補 ${work.warrantyMinutes}分（枠から除外）／未分類 ${work.unclassifiedMinutes}分 → 変更枠消費 ${work.billedMinutes === null ? '未確定（過去記録の分類を確認）' : `${work.billedMinutes}分（月合計を5分で切り上げ）`}${work.partial ? '（記録開始が月の途中）' : ''}`,
    );
    console.log(
      average.averageMinutes === null
        ? '3か月平均：月初からの記録と作業区分が 3 か月分そろっていないため出しません'
        : `3か月平均：${average.averageMinutes.toFixed(1)}分`,
    );
    const plan = args.optional('plan');
    if (plan && work.tracked && !work.partial && work.billedMinutes !== null) {
      const allowance = allowanceFor(plan);
      const rest = allowance.minutes - work.billedMinutes;
      console.log(
        `「${allowance.name}」の変更枠 ${allowance.minutes}分／${rest >= 0 ? `残り ${rest}分` : `超過 ${-rest}分（次月対応か追加見積もりの選択を確認する）`}`,
      );
    }
  },
});
