/** npm run ops:crm -- <command>。使い方は tools/ops/README.md。 */
import { join } from 'node:path';
import { estimateFileSchema, findVersion } from '../estimate/model';
import { loadCustomerMetrics } from '../metrics/model';
import { loadRequests } from '../requests/model';
import { type Args, runCli } from '../shared/cli';
import {
  OpsError,
  parseId,
  resolveDataDir,
  resolveOutputFile,
  readJson,
  writeJson,
} from '../shared/store';
import { jstDate, now, parseDate } from '../shared/time';
import {
  type CustomerFile,
  HANDOVER_LABELS,
  STATE_LABELS,
  addConsultation,
  addProject,
  advanceProject,
  blockersFor,
  completeChecklistItem,
  createCustomer,
  customerPath,
  linkEstimate,
  loadCustomer,
  recordApproval,
  recordContract,
  recordHandover,
} from './model';

const USAGE = `
npm run ops:crm -- init      --customer <顧客ID> --name <名前> --owner <担当> --by <記録者>
npm run ops:crm -- consult   --customer <顧客ID> --channel <経路> --summary <内容> --by <記録者>
npm run ops:crm -- project   --customer <顧客ID> --project <案件ID> --title <件名> --by <記録者>
npm run ops:crm -- estimate  --customer <顧客ID> --project <案件ID> --estimate <見積番号> --version <版> --by <記録者>
npm run ops:crm -- contract  --customer <顧客ID> --project <案件ID> --version <版> --status draft|sent|signed --ref <書面の保管場所> [--signed-on YYYY-MM-DD] --by <記録者>
npm run ops:crm -- approval  --customer <顧客ID> --project <案件ID> --id <承認ID> --kind copy|photo --item <対象> --status pending|approved|changes_requested [--decided-by <判断者> --decided-on YYYY-MM-DD] --by <記録者>
npm run ops:crm -- check     --customer <顧客ID> --project <案件ID> --key <項目> --evidence <根拠> --by <確認者> [--on YYYY-MM-DD]
npm run ops:crm -- handover  --customer <顧客ID> --project <案件ID> --item source_code|manual|photos|github_invite --ref <保管場所・招待先> --by <記録者> [--permission read] [--on YYYY-MM-DD]
npm run ops:crm -- advance   --customer <顧客ID> --project <案件ID> --to <状態> --by <記録者>
npm run ops:crm -- show      --customer <顧客ID>
npm run ops:crm -- export    --customer <顧客ID> --out <ファイル>
共通: [--data <データの置き場所>]
`;

const open = (args: Args) => {
  const dataDir = resolveDataDir(args.optional('data'));
  const customerId = parseId(args.required('customer'), '--customer');
  const file = loadCustomer(dataDir, customerId);
  if (!file) throw new OpsError(`顧客が登録されていません: ${customerId}`);
  const m = { at: now(), by: args.required('by') };
  const save = (next: CustomerFile, message: string) => {
    writeJson(customerPath(dataDir, customerId), next);
    console.log(message);
  };
  return {
    dataDir,
    customerId,
    file,
    m,
    save,
    project: () => parseId(args.required('project'), '--project'),
  };
};
const dayOf = (args: Args, name: string) =>
  parseDate(args.optional(name) ?? jstDate(now()), `--${name}`);

runCli(USAGE, {
  init(args) {
    const dataDir = resolveDataDir(args.optional('data'));
    const customerId = parseId(args.required('customer'), '--customer');
    if (loadCustomer(dataDir, customerId)) throw new OpsError('既に登録されています');
    const file = createCustomer(
      { customerId, name: args.required('name'), owner: args.required('owner') },
      { at: now(), by: args.required('by') },
    );
    writeJson(customerPath(dataDir, customerId), file);
    console.log(`${customerPath(dataDir, customerId)} に登録しました`);
  },
  consult(args) {
    const c = open(args);
    c.save(
      addConsultation(
        c.file,
        { channel: args.required('channel'), summary: args.required('summary') },
        c.m,
      ),
      '相談を記録しました',
    );
  },
  project(args) {
    const c = open(args);
    c.save(
      addProject(c.file, { id: c.project(), title: args.required('title') }, c.m),
      '案件を登録しました',
    );
  },
  estimate(args) {
    const c = open(args);
    const id = parseId(args.required('estimate'), '--estimate');
    const estimate = readJson(join(c.dataDir, 'estimates', `${id}.json`), estimateFileSchema);
    if (estimate.estimateId !== id || estimate.versions.some((v) => v.input.estimateId !== id))
      throw new OpsError('見積番号と保存内容が一致しません');
    const version = findVersion(estimate, args.integer('version'));
    c.save(linkEstimate(c.file, c.project(), version, c.m), '見積の版を紐付けました');
  },
  contract(args) {
    const c = open(args);
    const status = args.required('status');
    if (status !== 'draft' && status !== 'sent' && status !== 'signed')
      throw new OpsError('--status は draft・sent・signed');
    const signedOn = args.optional('signed-on');
    c.save(
      recordContract(
        c.file,
        c.project(),
        {
          version: args.integer('version'),
          status,
          ref: args.required('ref'),
          ...(signedOn ? { signedOn: parseDate(signedOn, '--signed-on') } : {}),
        },
        c.m,
      ),
      '契約の版を記録しました',
    );
  },
  approval(args) {
    const c = open(args);
    const kind = args.required('kind');
    const status = args.required('status');
    if (kind !== 'copy' && kind !== 'photo') throw new OpsError('--kind は copy か photo');
    if (status !== 'pending' && status !== 'approved' && status !== 'changes_requested')
      throw new OpsError('--status は pending・approved・changes_requested');
    const decidedBy = args.optional('decided-by');
    const decidedOn = args.optional('decided-on');
    c.save(
      recordApproval(
        c.file,
        c.project(),
        {
          id: parseId(args.required('id'), '--id'),
          kind,
          item: args.required('item'),
          status,
          ...(decidedBy ? { decidedBy } : {}),
          ...(decidedOn ? { decidedOn: parseDate(decidedOn, '--decided-on') } : {}),
        },
        c.m,
      ),
      '承認の記録を更新しました',
    );
  },
  check(args) {
    const c = open(args);
    c.save(
      completeChecklistItem(
        c.file,
        c.project(),
        {
          key: args.required('key'),
          doneOn: dayOf(args, 'on'),
          by: c.m.by,
          evidence: args.required('evidence'),
        },
        c.m,
      ),
      '納品チェックを記録しました',
    );
  },
  handover(args) {
    const c = open(args);
    const permission = args.optional('permission');
    c.save(
      recordHandover(
        c.file,
        c.project(),
        args.required('item'),
        {
          recordedOn: dayOf(args, 'on'),
          by: c.m.by,
          ref: args.required('ref'),
          ...(permission ? { permission } : {}),
        },
        c.m,
      ),
      '引渡しを記録しました',
    );
  },
  advance(args) {
    const c = open(args);
    c.save(advanceProject(c.file, c.project(), args.required('to'), c.m), '状態を進めました');
  },
  show(args) {
    const dataDir = resolveDataDir(args.optional('data'));
    const customerId = parseId(args.required('customer'), '--customer');
    const file = loadCustomer(dataDir, customerId);
    if (!file) throw new OpsError(`顧客が登録されていません: ${customerId}`);
    console.log(`${file.name}（担当 ${file.owner}）相談 ${file.consultations.length} 件`);
    for (const p of file.projects) {
      console.log(`- ${p.id} ${p.title}：${STATE_LABELS[p.state]}`);
      console.log(
        `  見積 ${p.estimates.map((e) => `${e.estimateId} 第${e.version}版`).join('、') || 'なし'}／契約 ${p.contracts.map((k) => `第${k.version}版 ${k.status}`).join('、') || 'なし'}`,
      );
      console.log(
        `  納品チェック ${p.checklist.filter((c) => c.done).length}/${p.checklist.length}／引渡し ${
          Object.keys(p.handover)
            .map((k) => HANDOVER_LABELS[k as keyof typeof HANDOVER_LABELS])
            .join('、') || 'なし'
        }`,
      );
      const nextStates = (Object.keys(STATE_LABELS) as (keyof typeof STATE_LABELS)[]).filter(
        (s) => blockersFor(p, s)[0]?.includes('には進められません') !== true,
      );
      for (const s of nextStates) {
        const blockers = blockersFor(p, s);
        console.log(
          `  → ${STATE_LABELS[s]}：${blockers.length ? blockers.join('／') : '進められます'}`,
        );
      }
    }
  },
  export(args) {
    const dataDir = resolveDataDir(args.optional('data'));
    const customerId = parseId(args.required('customer'), '--customer');
    const customer = loadCustomer(dataDir, customerId);
    if (!customer) throw new OpsError(`顧客が登録されていません: ${customerId}`);
    const out = resolveOutputFile(args.required('out'));
    // この顧客の ID で照合できるファイルだけを入れる。見積は顧客 ID を持たないので、番号の参照だけを入れる。
    writeJson(out, {
      exportedAt: now(),
      customerId,
      customer,
      requests: loadRequests(dataDir, customerId),
      metricsSources: loadCustomerMetrics(dataDir, customerId).sources,
      estimateReferences: customer.projects.flatMap((p) =>
        p.estimates.map((e) => ({ project: p.id, ...e })),
      ),
      note: '見積の本体は estimates/ から番号で取り出し、宛名を確認してから渡す',
    });
    console.log(`${join(out)} に書き出しました`);
  },
});
