/**
 * 顧客管理と案件の進行（Issue #27、ADR 0038）。
 * 顧客ごとに 1 ファイル。案件の状態は遷移表と、遷移ごとの前提条件（見積・契約・承認・納品チェック・引渡し）で検査する。
 * 他の顧客の情報を読めない権限は未実装。ファイルを分け、読み込み時に顧客 ID を照合する。
 */
import type { EstimateVersion } from '../estimate/model';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { OpsError, assertCustomer, assertNoCredential, idSchema, readJson } from '../shared/store';
import { dateSchema, timestampSchema } from '../shared/time';

const STATES = [
  'consulting',
  'estimate_sent',
  'contracted',
  'in_production',
  'awaiting_acceptance',
  'accepted',
  'handed_over',
  'closed_lost',
] as const;
type State = (typeof STATES)[number];
const stateSchema = z.enum(STATES);
export const STATE_LABELS: Record<State, string> = {
  consulting: '相談中',
  estimate_sent: '見積提出',
  contracted: '契約済み',
  in_production: '制作中',
  awaiting_acceptance: '検収待ち',
  accepted: '検収済み',
  handed_over: '引渡し済み',
  closed_lost: '失注・中止',
};
const NEXT: Record<State, readonly State[]> = {
  consulting: ['estimate_sent', 'closed_lost'],
  estimate_sent: ['consulting', 'contracted', 'closed_lost'],
  contracted: ['in_production', 'closed_lost'],
  in_production: ['awaiting_acceptance', 'closed_lost'],
  awaiting_acceptance: ['in_production', 'accepted'],
  accepted: ['handed_over'],
  handed_over: [],
  closed_lost: [],
};

const text = z.string().trim().min(1);
const meta = z.strictObject({ at: timestampSchema, by: text });

/**
 * 納品前に確かめる項目。ガイドラインの納品物と、AGENTS.md の「verify に FAIL があれば納品しない」から。
 */
const DEFAULT_CHECKLIST = [
  { key: 'verify-fail-zero', label: '納品物の検査が FAIL 0' },
  { key: 'domain-customer-name', label: 'ドメインがお客様名義' },
  { key: 'no-secrets-in-source', label: 'パスワード類をソースコードに入れていない' },
] as const;

const HANDOVER_ITEMS = ['source_code', 'manual', 'photos', 'github_invite'] as const;
type HandoverItem = (typeof HANDOVER_ITEMS)[number];
export const HANDOVER_LABELS: Record<HandoverItem, string> = {
  source_code: 'ソースコード一式',
  manual: '引き継ぎ手順書',
  photos: '写真の元データ',
  github_invite: 'GitHub の閲覧招待',
};
const handoverRecord = z.strictObject({
  recordedOn: dateSchema,
  by: text,
  ref: text,
  note: text.optional(),
});

/**
 * サイトの運用に要るアカウント。名義（holder）と、引渡し後の紬側のアクセス（access）を記録する。
 * パスワードは記録しない。`ref` は管理画面や登録事業者の名前までにする（ADR 0082）。
 */
const ACCOUNT_KINDS = ['domain', 'hosting', 'cms', 'analytics', 'mail', 'other'] as const;
type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  domain: 'ドメイン',
  hosting: 'ホスティング',
  cms: 'CMS',
  analytics: 'アクセス解析',
  mail: 'メール',
  other: 'その他',
};
/** 引渡しに必ず要る種類。サイトを自分で持ち続けられる条件（ガイドライン 5.4）。 */
const REQUIRED_ACCOUNT_KINDS = ['domain', 'hosting'] as const;
export const ACCOUNT_HOLDER_LABELS = { customer: 'お客様名義', tsumugi: '紬名義' } as const;
export const ACCOUNT_ACCESS_LABELS = { revoked: '撤回済み', retained: '保持' } as const;

export const accountSchema = z
  .strictObject({
    id: idSchema,
    kind: z.enum(ACCOUNT_KINDS),
    service: text,
    holder: z.enum(['customer', 'tsumugi']),
    ref: text,
    /** お客様名義であることを確かめた日（移管した場合は移管日）。 */
    transferredOn: dateSchema.optional(),
    access: z.enum(['revoked', 'retained']),
    revokedOn: dateSchema.optional(),
    retainedReason: text.optional(),
    note: text.optional(),
  })
  .refine(
    (a) => (a.holder === 'customer') === (a.transferredOn !== undefined),
    'お客様名義には確認日（移管日）が必要です。紬名義には記録しません',
  )
  .refine(
    (a) => (a.access === 'revoked') === (a.revokedOn !== undefined),
    'アクセスの撤回には撤回日が必要です',
  )
  .refine(
    (a) => (a.access === 'retained') === (a.retainedReason !== undefined),
    'アクセスを保持する場合は理由が必要です',
  );
export type Account = z.infer<typeof accountSchema>;

const projectSchema = z.strictObject({
  id: idSchema,
  title: text,
  state: stateSchema,
  estimates: z.array(z.strictObject({ estimateId: idSchema, version: z.int().min(1) })),
  contracts: z.array(
    z
      .strictObject({
        version: z.int().min(1),
        status: z.enum(['draft', 'sent', 'signed']),
        ref: text,
        signedOn: dateSchema.optional(),
      })
      .refine(
        (c) => (c.status === 'signed') === (c.signedOn !== undefined),
        '締結日は締結済みの契約だけに記録します',
      ),
  ),
  approvals: z.array(
    z
      .strictObject({
        id: idSchema,
        kind: z.enum(['copy', 'photo']),
        item: text,
        status: z.enum(['pending', 'approved', 'changes_requested']),
        decidedBy: text.optional(),
        decidedOn: dateSchema.optional(),
      })
      .refine(
        (a) => a.status === 'pending' || (a.decidedBy !== undefined && a.decidedOn !== undefined),
        '承認・修正依頼には判断者と日付が必要です',
      ),
  ),
  checklist: z.array(
    z
      .strictObject({
        key: idSchema,
        label: text,
        done: z.boolean(),
        doneOn: dateSchema.optional(),
        by: text.optional(),
        evidence: text.optional(),
      })
      .refine(
        (c) => !c.done || (c.doneOn && c.by && c.evidence),
        '完了した項目には日付・確認者・根拠が必要です',
      ),
  ),
  accounts: z.array(accountSchema).default([]),
  handover: z.strictObject({
    source_code: handoverRecord.optional(),
    manual: handoverRecord.optional(),
    photos: handoverRecord.optional(),
    /** 書き込み権限は渡さない（ガイドライン 5.4）。 */
    github_invite: handoverRecord.extend({ permission: z.literal('read') }).optional(),
  }),
  stateHistory: z.array(meta.extend({ from: stateSchema.nullable(), to: stateSchema })).min(1),
});
type Project = z.infer<typeof projectSchema>;

const customerFileSchema = z
  .strictObject({
    customerId: idSchema,
    name: text,
    owner: text,
    contacts: z.array(z.strictObject({ role: text, name: text.optional(), note: text.optional() })),
    consultations: z.array(meta.extend({ channel: text, summary: text })),
    projects: z.array(projectSchema),
    history: z.array(meta.extend({ action: text })),
  })
  .superRefine((file, ctx) => {
    const ids = new Set<string>();
    file.projects.forEach((p, i) => {
      if (ids.has(p.id))
        ctx.addIssue({
          code: 'custom',
          path: ['projects', i, 'id'],
          message: `案件 ID が重複: ${p.id}`,
        });
      ids.add(p.id);
      if (p.stateHistory.at(-1)?.to !== p.state)
        ctx.addIssue({
          code: 'custom',
          path: ['projects', i, 'state'],
          message: '状態と履歴が一致しません',
        });
    });
  });
export type CustomerFile = z.infer<typeof customerFileSchema>;
type Meta = z.infer<typeof meta>;

const validate = (file: unknown): CustomerFile => {
  const parsed = customerFileSchema.safeParse(file);
  if (!parsed.success)
    throw new OpsError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  return parsed.data;
};
const findProject = (file: CustomerFile, id: string) => {
  const project = file.projects.find((p) => p.id === id);
  if (!project) throw new OpsError(`案件がありません: ${id}`);
  return project;
};
const withProject = (file: CustomerFile, project: Project, m: Meta, action: string) =>
  validate({
    ...file,
    projects: file.projects.map((p) => (p.id === project.id ? project : p)),
    history: [...file.history, { ...m, action: `${project.id}: ${action}` }],
  });
const editable = (project: Project) => {
  if (project.state === 'handed_over' || project.state === 'closed_lost')
    throw new OpsError(`「${STATE_LABELS[project.state]}」の案件は変更しません`);
};

export function createCustomer(
  input: { customerId: string; name: string; owner: string },
  m: Meta,
): CustomerFile {
  return validate({
    ...input,
    contacts: [],
    consultations: [],
    projects: [],
    history: [{ ...m, action: '顧客を登録' }],
  });
}

export function addConsultation(
  file: CustomerFile,
  input: { channel: string; summary: string },
  m: Meta,
): CustomerFile {
  return validate({
    ...file,
    consultations: [...file.consultations, { ...m, ...input }],
    history: [...file.history, { ...m, action: '相談を記録' }],
  });
}

export function addProject(
  file: CustomerFile,
  input: { id: string; title: string },
  m: Meta,
): CustomerFile {
  if (file.projects.some((p) => p.id === input.id))
    throw new OpsError(`案件 ID が重複: ${input.id}`);
  return validate({
    ...file,
    projects: [
      ...file.projects,
      {
        ...input,
        state: 'consulting',
        estimates: [],
        contracts: [],
        approvals: [],
        checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c, done: false })),
        accounts: [],
        handover: {},
        stateHistory: [{ ...m, from: null, to: 'consulting' }],
      },
    ],
    history: [...file.history, { ...m, action: `${input.id}: 案件を登録` }],
  });
}

export function linkEstimate(
  file: CustomerFile,
  projectId: string,
  estimate: EstimateVersion,
  m: Meta,
) {
  const p = findProject(file, projectId);
  editable(p);
  if (estimate.input.customerId !== file.customerId || estimate.input.projectId !== projectId)
    throw new OpsError('見積の顧客・案件が一致しません。帰属のない旧見積は紐付けできません');
  const ref = { estimateId: estimate.input.estimateId, version: estimate.version };
  if (p.estimates.some((e) => e.estimateId === ref.estimateId && e.version === ref.version))
    throw new OpsError('この見積の版は紐付け済みです');
  return withProject(
    file,
    { ...p, estimates: [...p.estimates, ref] },
    m,
    `見積 ${ref.estimateId} 第${ref.version}版を紐付け`,
  );
}

export function recordContract(
  file: CustomerFile,
  projectId: string,
  contract: {
    version: number;
    status: 'draft' | 'sent' | 'signed';
    ref: string;
    signedOn?: string;
  },
  m: Meta,
) {
  const p = findProject(file, projectId);
  editable(p);
  const existing = p.contracts.find((c) => c.version === contract.version);
  if (existing?.status === 'signed')
    throw new OpsError(
      `契約 第${contract.version}版は締結済みです。新しい版として記録してください`,
    );
  const contracts = [...p.contracts.filter((c) => c.version !== contract.version), contract].sort(
    (a, b) => a.version - b.version,
  );
  return withProject(
    file,
    { ...p, contracts },
    m,
    `契約 第${contract.version}版を ${contract.status} として記録`,
  );
}

export function recordApproval(
  file: CustomerFile,
  projectId: string,
  approval: Project['approvals'][number],
  m: Meta,
) {
  const p = findProject(file, projectId);
  editable(p);
  const approvals = [...p.approvals.filter((a) => a.id !== approval.id), approval];
  return withProject(
    file,
    { ...p, approvals },
    m,
    `${approval.kind === 'copy' ? '原稿' : '写真'}「${approval.item}」を ${approval.status}`,
  );
}

export function completeChecklistItem(
  file: CustomerFile,
  projectId: string,
  item: { key: string; doneOn: string; by: string; evidence: string },
  m: Meta,
) {
  const p = findProject(file, projectId);
  editable(p);
  if (!p.checklist.some((c) => c.key === item.key))
    throw new OpsError(`納品チェックの項目がありません: ${item.key}`);
  const checklist = p.checklist.map((c) =>
    c.key === item.key
      ? { ...c, done: true, doneOn: item.doneOn, by: item.by, evidence: item.evidence }
      : c,
  );
  return withProject(file, { ...p, checklist }, m, `納品チェック ${item.key} を完了`);
}

export function recordAccount(
  file: CustomerFile,
  projectId: string,
  account: Account,
  m: Meta,
): CustomerFile {
  const p = findProject(file, projectId);
  editable(p);
  assertNoCredential('アカウントの参照', account.ref);
  if (account.note) assertNoCredential('アカウントの備考', account.note);
  const accounts = [...p.accounts.filter((a) => a.id !== account.id), account].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  return withProject(
    file,
    { ...p, accounts },
    m,
    `${ACCOUNT_KIND_LABELS[account.kind]}「${account.service}」を ${ACCOUNT_HOLDER_LABELS[account.holder]}・アクセス${ACCOUNT_ACCESS_LABELS[account.access]}として記録`,
  );
}

/**
 * 資料の受け渡しより前に満たす条件（検収・名義・アクセス）。引渡し資料を作る前に確かめる（ADR 0082）。
 * 引渡しの記録そのものは含まない。資料を渡してから記録するため。
 */
export function transferBlockers(project: Project): string[] {
  const blockers: string[] = [];
  if (project.state !== 'accepted' && project.state !== 'handed_over')
    blockers.push(`「${STATE_LABELS[project.state]}」の案件です。検収済みになってから引き渡します`);
  for (const c of project.checklist.filter((c) => !c.done))
    blockers.push(`納品チェック「${c.label}」が未完了です`);
  for (const kind of REQUIRED_ACCOUNT_KINDS)
    if (!project.accounts.some((a) => a.kind === kind))
      blockers.push(`${ACCOUNT_KIND_LABELS[kind]}のアカウントが未記録です`);
  for (const a of project.accounts)
    if (a.holder !== 'customer')
      blockers.push(
        `${ACCOUNT_KIND_LABELS[a.kind]}「${a.service}」がお客様名義ではありません（${ACCOUNT_HOLDER_LABELS[a.holder]}）`,
      );
  return blockers;
}

export function recordHandover(
  file: CustomerFile,
  projectId: string,
  item: string,
  record: { recordedOn: string; by: string; ref: string; note?: string; permission?: string },
  m: Meta,
) {
  const p = findProject(file, projectId);
  editable(p);
  const key = z.enum(HANDOVER_ITEMS).safeParse(item);
  if (!key.success) throw new OpsError(`引渡しの項目は ${HANDOVER_ITEMS.join('・')} のどれか`);
  if (p.state !== 'accepted') throw new OpsError('引渡しは検収済みの案件だけに記録します');
  const { permission, ...rest } = record;
  if (key.data === 'github_invite' && permission !== 'read')
    throw new OpsError('GitHub は閲覧（read）権限で招待します。書き込み権限は渡しません');
  const value = key.data === 'github_invite' ? { ...rest, permission } : rest;
  return withProject(
    file,
    { ...p, handover: { ...p.handover, [key.data]: value } },
    m,
    `${HANDOVER_LABELS[key.data]}の引渡しを記録`,
  );
}

/** 遷移の前提条件。空なら進められる。 */
export function blockersFor(project: Project, to: State): string[] {
  const blockers: string[] = [];
  if (!NEXT[project.state].includes(to))
    return [`「${STATE_LABELS[project.state]}」から「${STATE_LABELS[to]}」には進められません`];
  if (to === 'estimate_sent' && !project.estimates.length)
    blockers.push('見積の版が紐付いていません');
  if (to === 'contracted' && !project.contracts.some((c) => c.status === 'signed'))
    blockers.push('締結済みの契約がありません');
  if (to === 'awaiting_acceptance') {
    for (const kind of ['copy', 'photo'] as const) {
      const items = project.approvals.filter((a) => a.kind === kind);
      const label = kind === 'copy' ? '原稿' : '写真';
      if (!items.length) blockers.push(`${label}の承認記録がありません`);
      for (const a of items.filter((a) => a.status !== 'approved'))
        blockers.push(`${label}「${a.item}」が未承認です`);
    }
  }
  if (to === 'accepted')
    for (const c of project.checklist.filter((c) => !c.done))
      blockers.push(`納品チェック「${c.label}」が未完了です`);
  if (to === 'handed_over') {
    blockers.push(...transferBlockers(project));
    for (const item of HANDOVER_ITEMS)
      if (!project.handover[item]) blockers.push(`${HANDOVER_LABELS[item]}の引渡しが未記録です`);
  }
  return blockers;
}

export function advanceProject(
  file: CustomerFile,
  projectId: string,
  to: string,
  m: Meta,
): CustomerFile {
  const p = findProject(file, projectId);
  const target = stateSchema.safeParse(to);
  if (!target.success) throw new OpsError(`状態は ${STATES.join('・')} のどれか`);
  const blockers = blockersFor(p, target.data);
  if (blockers.length) throw new OpsError(blockers.join('\n'));
  return withProject(
    file,
    {
      ...p,
      state: target.data,
      stateHistory: [...p.stateHistory, { ...m, from: p.state, to: target.data }],
    },
    m,
    `${STATE_LABELS[p.state]} → ${STATE_LABELS[target.data]}`,
  );
}

export const customerPath = (dataDir: string, customerId: string) =>
  join(dataDir, 'crm', `${customerId}.json`);

export function loadCustomer(dataDir: string, customerId: string): CustomerFile | null {
  const path = customerPath(dataDir, customerId);
  if (!existsSync(path)) return null;
  const file = readJson(path, customerFileSchema);
  assertCustomer(path, customerId, file.customerId);
  return file;
}
