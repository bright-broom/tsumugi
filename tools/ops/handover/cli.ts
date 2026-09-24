/** npm run ops:handover -- <command>。使い方は tools/ops/README.md（ADR 0082）。 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { ROOT } from '../../paths';
import { createBackup, git } from '../backup';
import {
  HANDOVER_LABELS,
  loadCustomer,
  customerPath,
  recordHandover,
  transferBlockers,
  type CustomerFile,
} from '../crm/model';
import { restoreTest, type BuildMode, type DepsMode } from '../restore';
import { type Args, runCli } from '../shared/cli';
import { OpsError, parseId, resolveDataDir, readJson, writeJson } from '../shared/store';
import { jstDate, now, parseDate } from '../shared/time';
import {
  CHECKSUMS,
  DOCUMENT,
  INDEX,
  MATERIALS_DIR,
  SOURCE_DIR,
  evidenceFrom,
  folderTotals,
  indexSchema,
  isDirectory,
  materialProblems,
  packageFiles,
  seal,
  sealProblems,
  writeDocuments,
  type HandoverIndex,
} from './model';

const USAGE = `
npm run ops:handover -- plan   --customer <顧客ID> --project <案件ID> [--report <検査レポート>]
npm run ops:handover -- pack   --customer <顧客ID> --project <案件ID> --by <担当> [--on YYYY-MM-DD] [--out <置き場所>] [--report <検査レポート>] [--material <元素材のフォルダ>]...
npm run ops:handover -- verify --package <引渡し資料のフォルダ> [--deps ci|clone|link|none] [--build build|typecheck|none] [--work <作業場所>]
npm run ops:handover -- record --customer <顧客ID> --project <案件ID> --package <引渡し資料のフォルダ> --by <記録者> [--github <招待先>] [--photos <保管場所>] [--on YYYY-MM-DD]
共通: [--data <データの置き場所>]

pack は検収済み・名義の確認済みの案件だけを梱包し、verify で「別のフォルダで作り直せた」ことを
確かめてから封（SHA256SUMS）をする。record は封のある資料だけを CRM の引渡し記録にする。
`;

const REPORT = join(ROOT, '.artifacts', 'verification', 'verify-report.json');
const DEFAULT_OUT = join(ROOT, '.artifacts', 'handover');

const open = (args: Args) => {
  const dataDir = resolveDataDir(args.optional('data'));
  const customerId = parseId(args.required('customer'), '--customer');
  const file = loadCustomer(dataDir, customerId);
  if (!file) throw new OpsError(`顧客が登録されていません: ${customerId}`);
  const projectId = parseId(args.required('project'), '--project');
  const project = file.projects.find((p) => p.id === projectId);
  if (!project) throw new OpsError(`案件がありません: ${projectId}`);
  return { dataDir, customerId, file, project };
};

const readReport = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new OpsError(
      `検査レポートを読めません: ${file}（npm run build && npm run verify -- --mode production の後に実行してください）`,
    );
  }
};

const headCommit = () => git(ROOT, ['rev-parse', 'HEAD']).trim();

const pick = <T extends string>(value: string, allowed: readonly T[], flag: string): T => {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new OpsError(`${flag} は ${allowed.join(' / ')} のどれか: ${value}`);
};

const readIndex = (args: Args): { dir: string; index: HandoverIndex } => {
  const dir = resolve(args.required('package'));
  resolveDataDir(dir);
  if (!existsSync(join(dir, INDEX))) throw new OpsError(`引渡し資料がありません: ${dir}`);
  return { dir, index: readJson(join(dir, INDEX), indexSchema) };
};

runCli(USAGE, {
  plan(args) {
    const { project } = open(args);
    const blockers = transferBlockers(project);
    for (const blocker of blockers) console.log(`未了  ${blocker}`);
    const report = resolve(args.optional('report') ?? REPORT);
    try {
      const evidence = evidenceFrom(readReport(report), headCommit());
      console.log(
        `OK    検査の実績：${evidence.measuredOn}・PASS ${evidence.pass}・WARN ${evidence.warn}・FAIL 0（${evidence.commit.slice(0, 7)}）`,
      );
    } catch (error) {
      if (!(error instanceof OpsError)) throw error;
      console.log(`未了  ${error.message}`);
      blockers.push(error.message);
    }
    console.log(
      blockers.length
        ? `\n引渡し資料はまだ作れません（${blockers.length} 件）`
        : '\n引渡し資料を作れます: npm run ops:handover -- pack …',
    );
    process.exitCode = blockers.length ? 1 : 0;
  },

  pack(args) {
    const { file, project } = open(args);
    const blockers = transferBlockers(project);
    if (blockers.length) throw new OpsError(blockers.join('\n'));
    const by = args.required('by');
    const on = parseDate(args.optional('on') ?? jstDate(now()), '--on');
    const commit = headCommit();
    const verification = evidenceFrom(
      readReport(resolve(args.optional('report') ?? REPORT)),
      commit,
    );

    const out = resolve(args.optional('out') ?? DEFAULT_OUT);
    resolveDataDir(out);
    const dir = join(out, `${file.customerId}-${project.id}-${on.replaceAll('-', '')}`);
    mkdirSync(out, { recursive: true, mode: 0o700 });
    // 既にある資料は上書きしない。作り直すときは、ひとつ前の資料を残したまま日付を変える。
    mkdirSync(dir, { mode: 0o700 });

    const { dir: sourceDir, manifest } = createBackup({
      root: ROOT,
      outDir: join(dir, SOURCE_DIR),
    });
    const materials = args.list('material').map((path) => {
      const from = resolve(path);
      if (!isDirectory(from)) throw new OpsError(`元素材はフォルダで指定してください: ${from}`);
      const name = basename(from);
      const problems = materialProblems(
        packageFiles(from).map((f) => ({
          path: f.path,
          content: () => (f.bytes > 5 * 1024 * 1024 ? null : readFileSync(join(from, f.path))),
        })),
      );
      if (problems.length)
        throw new OpsError(`同梱できないものが元素材に入っています:\n${problems.join('\n')}`);
      cpSync(from, join(dir, MATERIALS_DIR, name), { recursive: true });
      return { dir: name, ...folderTotals(join(dir, MATERIALS_DIR, name)) };
    });

    const index: HandoverIndex = {
      format: 1,
      createdAt: now(),
      createdBy: by,
      handedOverOn: on,
      customer: { id: file.customerId, name: file.name },
      project: { id: project.id, title: project.title },
      commit,
      source: {
        dir: basename(sourceDir),
        bundle: manifest.bundle.sha256,
        files: manifest.files.length,
        bytes: manifest.files.reduce((sum, f) => sum + f.bytes, 0),
      },
      materials,
      accounts: project.accounts,
      verification,
      documents: [`${DOCUMENT}.md`, `${DOCUMENT}.html`],
      files: [],
      sealedAt: null,
      restore: null,
    };
    writeDocuments(dir, index);
    writeJson(join(dir, INDEX), index);
    console.log(
      `${dir} に梱包しました（ソース ${index.source.files} ファイル・元素材 ${materials.length} 組）`,
    );
    console.log(
      `まだ封をしていません。別のフォルダで作り直せるかを確かめて封をします:\n  npm run ops:handover -- verify --package ${dir}`,
    );
  },

  verify(args) {
    const { dir, index } = readIndex(args);
    if (index.sealedAt)
      throw new OpsError(
        `封のある資料です（${index.sealedAt}）。作り直す場合は pack からやり直してください`,
      );
    const work = args.optional('work');
    if (work) mkdirSync(resolve(work), { recursive: true });
    const report = restoreTest({
      backupDir: join(dir, SOURCE_DIR, index.source.dir),
      workDir: mkdtempSync(join(work ? resolve(work) : tmpdir(), 'tsumugi-handover-')),
      deps: pick<DepsMode>(
        args.optional('deps') ?? 'ci',
        ['ci', 'clone', 'link', 'none'],
        '--deps',
      ),
      build: pick<BuildMode>(
        args.optional('build') ?? 'build',
        ['build', 'typecheck', 'none'],
        '--build',
      ),
      sourceRoot: ROOT,
    });
    for (const step of report.steps)
      console.log(
        `${step.ok ? 'OK  ' : 'FAIL'}  ${step.name}（${(step.ms / 1000).toFixed(1)} 秒）: ${step.detail}`,
      );
    if (!report.ok) {
      console.error('\n作り直せませんでした。封をしません（この資料は引き渡せません）');
      process.exitCode = 1;
      return;
    }
    seal(dir, {
      ...index,
      restore: {
        checkedAt: new Date().toISOString(),
        ok: true,
        totalMs: report.totalMs,
        deps: report.deps,
        build: report.build,
        environment: report.environment,
        steps: report.steps.map((s) => ({ name: s.name, ok: s.ok, ms: s.ms })),
      },
    });
    console.log(`\n別のフォルダで作り直せました。封をしました: ${join(dir, CHECKSUMS)}`);
  },

  record(args) {
    const { dataDir, file, project } = open(args);
    const { dir, index } = readIndex(args);
    if (!index.sealedAt)
      throw new OpsError(
        '封のない資料は引渡しの記録にしません。先に npm run ops:handover -- verify を通してください',
      );
    const problems = sealProblems(dir, readFileSync(join(dir, CHECKSUMS), 'utf8'));
    if (problems.length)
      throw new OpsError(`封と中身が合いません（作り直してください）:\n${problems.join('\n')}`);
    if (index.customer.id !== file.customerId || index.project.id !== project.id)
      throw new OpsError('引渡し資料の顧客・案件が一致しません');
    if (index.commit !== headCommit())
      console.log('注意: 引渡し資料のコミットは、いまの HEAD と違います（資料の内容が正です）');

    const m = { at: now(), by: args.required('by') };
    const recordedOn = parseDate(args.optional('on') ?? jstDate(now()), '--on');
    const photos =
      args.optional('photos') ?? (index.materials.length ? join(dir, MATERIALS_DIR) : undefined);
    const github = args.optional('github');
    type Entry = [string, { ref: string; note?: string; permission?: string }];
    const entries: Entry[] = [
      [
        'source_code',
        { ref: dir, note: `commit ${index.commit.slice(0, 7)}・封 ${index.sealedAt.slice(0, 10)}` },
      ],
      ['manual', { ref: join(dir, `${DOCUMENT}.md`) }],
      ...(photos ? [['photos', { ref: photos }] as Entry] : []),
      ...(github ? [['github_invite', { ref: github, permission: 'read' }] as Entry] : []),
    ];
    let next: CustomerFile = file;
    for (const [item, record] of entries)
      next = recordHandover(next, project.id, item, { recordedOn, by: m.by, ...record }, m);
    writeJson(customerPath(dataDir, file.customerId), next);
    for (const [item] of entries)
      console.log(`記録: ${HANDOVER_LABELS[item as keyof typeof HANDOVER_LABELS]}`);
    const missing = (['photos', 'github_invite'] as const).filter(
      (item) => !entries.some(([key]) => key === item),
    );
    for (const item of missing)
      console.log(
        `未記録: ${HANDOVER_LABELS[item]}（npm run ops:crm -- handover --item ${item} … で記録してください）`,
      );
    if (!missing.length)
      console.log(
        `\n引渡しの記録がそろいました: npm run ops:crm -- advance --customer ${file.customerId} --project ${project.id} --to handed_over --by <記録者>`,
      );
  },
});
