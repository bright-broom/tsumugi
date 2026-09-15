/** npm run ops:gbp -- <command>。使い方は tools/ops/README.md。 */
import { join } from 'node:path';
import { type Args, readText, runCli } from '../shared/cli';
import {
  OpsError,
  assertCustomer,
  parseId,
  readJson,
  resolveDataDir,
  writeJson,
} from '../shared/store';
import { jstDate, now, parseDate, today } from '../shared/time';
import {
  type GbpOps,
  approveChange,
  approveTask,
  compareProfiles,
  draftTask,
  dueTasks,
  editDraft,
  gbpDir,
  loadOps,
  profileSchema,
  proposeChange,
  recordChangeApplied,
  recordTaskDone,
} from './model';

const USAGE = `
npm run ops:gbp -- compare        --customer <顧客ID> [--site <サイト側.json>] [--gbp <GBP 側.json>]
npm run ops:gbp -- change         --customer <顧客ID> --id <変更ID> --field <項目> --value <正しい値> --target gbp|site --by <提案者>
npm run ops:gbp -- change-approve --customer <顧客ID> --id <変更ID> --by <承認者>
npm run ops:gbp -- change-applied --customer <顧客ID> --id <変更ID> --by <反映者> --evidence <確認方法>
npm run ops:gbp -- draft          --customer <顧客ID> --id <ID> --kind post|review_reply --due YYYY-MM-DD --text-file <文面> [--review-ref <対象の口コミ>] --by <作成者>
npm run ops:gbp -- edit           --customer <顧客ID> --id <ID> --text-file <文面> --by <修正者>
npm run ops:gbp -- approve        --customer <顧客ID> --id <ID> --by <承認者>
npm run ops:gbp -- done           --customer <顧客ID> --id <ID> --by <実施者> --evidence <実施の確認方法>
npm run ops:gbp -- due            --customer <顧客ID> [--today YYYY-MM-DD]
共通: [--data <データの置き場所>]
プロフィールの既定の置き場所は <データの置き場所>/gbp/<顧客ID>/site-profile.json と gbp-profile.json。
ツールは GBP に投稿・返信しない。人が実施した後に done で記録する。
`;

const open = (args: Args) => {
  const dataDir = resolveDataDir(args.optional('data'));
  const customerId = parseId(args.required('customer'), '--customer');
  const file = loadOps(dataDir, customerId);
  const save = (next: GbpOps, message: string) => {
    writeJson(join(gbpDir(dataDir, customerId), 'ops.json'), next);
    console.log(message);
  };
  return { dataDir, customerId, file, save, day: jstDate(now()) };
};

runCli(USAGE, {
  compare(args) {
    const c = open(args);
    const load = (flag: string, name: string) => {
      const path = args.optional(flag) ?? join(gbpDir(c.dataDir, c.customerId), name);
      const profile = readJson(path, profileSchema);
      assertCustomer(path, c.customerId, profile.customerId);
      return profile;
    };
    const site = load('site', 'site-profile.json');
    const gbp = load('gbp', 'gbp-profile.json');
    console.log(
      `サイト側：${site.source}（${site.capturedOn}）／GBP 側：${gbp.source}（${gbp.capturedOn}）`,
    );
    const labels = {
      match: '一致',
      notation: '表記ゆれ',
      mismatch: '不一致',
      missing: '片方だけ',
    } as const;
    const findings = compareProfiles(site, gbp);
    for (const f of findings)
      console.log(`${labels[f.kind]}\t${f.field}\tサイト: ${f.site}\tGBP: ${f.gbp}`);
    if (findings.some((f) => f.kind === 'mismatch' || f.kind === 'missing')) process.exitCode = 2;
  },
  change(args) {
    const c = open(args);
    c.save(
      proposeChange(c.file, {
        id: parseId(args.required('id'), '--id'),
        field: args.required('field'),
        value: args.required('value'),
        target: args.required('target'),
        by: args.required('by'),
        on: c.day,
      }),
      '変更を提案として記録しました（承認待ち）',
    );
  },
  'change-approve'(args) {
    const c = open(args);
    c.save(
      approveChange(c.file, args.required('id'), { by: args.required('by'), on: c.day }),
      '変更の承認を記録しました',
    );
  },
  'change-applied'(args) {
    const c = open(args);
    c.save(
      recordChangeApplied(c.file, args.required('id'), {
        by: args.required('by'),
        on: c.day,
        evidence: args.required('evidence'),
      }),
      '反映を記録しました',
    );
  },
  draft(args) {
    const c = open(args);
    const kind = args.required('kind');
    if (kind !== 'post' && kind !== 'review_reply')
      throw new OpsError('--kind は post か review_reply');
    const reviewRef = args.optional('review-ref');
    c.save(
      draftTask(
        c.file,
        {
          id: parseId(args.required('id'), '--id'),
          kind,
          dueOn: parseDate(args.required('due'), '--due'),
          draft: readText(args.required('text-file')).trim(),
          ...(reviewRef ? { reviewRef } : {}),
        },
        { at: now(), by: args.required('by') },
      ),
      '下書きを記録しました（承認待ち）',
    );
  },
  edit(args) {
    const c = open(args);
    c.save(
      editDraft(c.file, args.required('id'), readText(args.required('text-file')).trim(), {
        at: now(),
        by: args.required('by'),
      }),
      '文面を修正しました（承認は取り直し）',
    );
  },
  approve(args) {
    const c = open(args);
    c.save(
      approveTask(c.file, args.required('id'), { at: now(), by: args.required('by'), on: c.day }),
      '承認を記録しました',
    );
  },
  done(args) {
    const c = open(args);
    c.save(
      recordTaskDone(c.file, args.required('id'), {
        at: now(),
        by: args.required('by'),
        on: c.day,
        evidence: args.required('evidence'),
      }),
      '実施を記録しました',
    );
  },
  due(args) {
    const c = open(args);
    const day = parseDate(args.optional('today') ?? today(), '--today');
    for (const { task, overdue } of dueTasks(c.file, day))
      console.log(
        [
          task.id,
          task.kind,
          task.status,
          `期日 ${task.dueOn}${overdue ? '（超過）' : ''}`,
          task.draft.slice(0, 30),
        ].join('\t'),
      );
  },
});
