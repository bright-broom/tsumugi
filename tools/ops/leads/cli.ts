/** npm run ops:leads -- <command>。使い方は tools/ops/README.md。 */
import { join } from 'node:path';
import { type Args, readText, runCli } from '../shared/cli';
import {
  OpsError,
  readJsonIfExists,
  resolveDataDir,
  resolveOutputFile,
  writeJson,
  writeText,
} from '../shared/store';
import { parseDate, today } from '../shared/time';
import {
  type Ledger,
  STATE_LABELS,
  exportForCrm,
  filterLeads,
  importLeads,
  ledgerSchema,
  purgeExpired,
  reviewLead,
  viewLedger,
} from './model';

const USAGE = `
npm run ops:leads -- import --file <CSV> --source <入力元> --collected-on YYYY-MM-DD (--retention-days <日数> | --no-expiry)
npm run ops:leads -- list   [--industry <業種>] [--area <地域>] [--min-score <点>] [--state unreviewed|needs_review|reviewed|excluded] [--site none|portal_only|own_site]
npm run ops:leads -- show   --id <見込み客ID>
npm run ops:leads -- review --id <見込み客ID> --state needs_review|reviewed|excluded --by <確認者> [--note <確認した内容>]
npm run ops:leads -- purge
npm run ops:leads -- export --out <CSV> [--include-needs-review] [絞り込みは list と同じ]
共通: [--data <データの置き場所>] [--today YYYY-MM-DD] [--review-cap <口コミ数の満点の件数、既定 100（仮置き）>]
自動収集・自動送信はしない。CSV の入力元・収集方法・利用条件はオーナーが決める。
`;

const open = (args: Args) => {
  const path = join(resolveDataDir(args.optional('data')), 'leads', 'ledger.json');
  const ledger: Ledger = readJsonIfExists(path, ledgerSchema) ?? { imports: [], leads: [] };
  const day = parseDate(args.optional('today') ?? today(), '--today');
  const options = { today: day, reviewCap: args.integer('review-cap', 100) };
  if (options.reviewCap < 1) throw new OpsError('--review-cap は 1 以上');
  return { path, ledger, day, options, save: (next: Ledger) => writeJson(path, next) };
};
const filtered = (args: Args, c: ReturnType<typeof open>) =>
  filterLeads(viewLedger(c.ledger, c.options), {
    industry: args.optional('industry'),
    area: args.optional('area'),
    minScore: args.integer('min-score', 0),
    state: args.optional('state'),
    siteStatus: args.optional('site'),
  });

runCli(USAGE, {
  import(args) {
    const c = open(args);
    const noExpiry = args.flag('no-expiry');
    const days = args.optional('retention-days');
    if (noExpiry === (days !== undefined))
      throw new OpsError(
        '保存期限を --retention-days か --no-expiry のどちらかで明示してください（利用条件はオーナーが確認する）',
      );
    const result = importLeads(c.ledger, readText(args.required('file')), {
      label: args.required('source'),
      collectedOn: parseDate(args.required('collected-on'), '--collected-on'),
      retentionDays: noExpiry ? null : args.integer('retention-days'),
    });
    c.save(result.ledger);
    console.log(
      `新規 ${result.added} 件・既存に追加 ${result.updated} 件・統合 ${result.merged} 件`,
    );
  },
  list(args) {
    const c = open(args);
    for (const v of filtered(args, c))
      console.log(
        [
          v.id,
          v.score,
          STATE_LABELS[v.state],
          v.name,
          v.industry,
          v.area,
          v.siteStatus,
          v.expired ? '期限切れ' : '',
          v.reasons.join('／'),
        ].join('\t'),
      );
  },
  show(args) {
    const c = open(args);
    const view = viewLedger(c.ledger, c.options).find((v) => v.id === args.required('id'));
    if (!view) throw new OpsError('見込み客がありません');
    console.log(JSON.stringify(view, null, 2));
  },
  review(args) {
    const c = open(args);
    const note = args.optional('note');
    c.save(
      reviewLead(c.ledger, args.required('id'), {
        state: args.required('state'),
        by: args.required('by'),
        on: c.day,
        ...(note ? { note } : {}),
      }),
    );
    console.log('確認の状態を記録しました');
  },
  purge(args) {
    const c = open(args);
    const result = purgeExpired(c.ledger, c.day);
    c.save(result.ledger);
    console.log(
      `保存期限を過ぎた ${result.purged} 件の情報を破棄しました（place_id と確認メモは残します）`,
    );
  },
  export(args) {
    const c = open(args);
    const out = resolveOutputFile(args.required('out'));
    writeText(
      out,
      exportForCrm(filtered(args, c), { includeNeedsReview: args.flag('include-needs-review') }),
    );
    console.log(`${out} に書き出しました`);
  },
});
