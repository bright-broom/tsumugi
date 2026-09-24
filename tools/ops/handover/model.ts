/**
 * 引渡し資料の梱包と、その証跡（ADR 0082）。
 *
 * 顧客に渡すのは「ソース一式（履歴ごと）・元素材・手順書・名義とアクセスの記録・検査の実績」で、
 * これを 1 つのフォルダにまとめ、ファイルごとの SHA-256 で封をする。
 * 封は「別の環境で作り直せた」ことを確かめてから行う（作り直せない資料を引き渡さない）。
 * パスワード・鍵は同梱しない。同梱物の中に見つけたら作らずに止まる。
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { z } from 'zod';
import { adoptReport } from '@/lib/verification-report';
import { digest, excludedPaths, findSecrets } from '../backup';
import {
  ACCOUNT_ACCESS_LABELS,
  ACCOUNT_HOLDER_LABELS,
  ACCOUNT_KIND_LABELS,
  accountSchema,
  type Account,
} from '../crm/model';
import { type Block, type DocumentModel, renderHtml, renderMarkdown } from '../shared/document';
import { type Issuer, issuerRows, siteIssuer } from '../shared/issuer';
import { OpsError, writeJson, writeText } from '../shared/store';
import { dateSchema, timestampSchema } from '../shared/time';

export const INDEX = 'handover.json';
export const CHECKSUMS = 'SHA256SUMS';
export const DOCUMENT = 'handover';
export const SOURCE_DIR = 'source';
export const MATERIALS_DIR = 'materials';

const text = z.string().trim().min(1);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const commitSchema = z.string().regex(/^[0-9a-f]{40}$/);

const fileSchema = z.strictObject({
  path: text,
  bytes: z.int().nonnegative(),
  sha256: sha256Schema,
});
export type PackageFile = z.infer<typeof fileSchema>;

const restoreSchema = z.strictObject({
  checkedAt: timestampSchema,
  ok: z.literal(true),
  totalMs: z.int().nonnegative(),
  deps: text,
  build: text,
  environment: z.strictObject({ node: text, platform: text, arch: text }),
  steps: z.array(z.strictObject({ name: text, ok: z.boolean(), ms: z.int().nonnegative() })),
});

const verificationSchema = z.strictObject({
  commit: commitSchema,
  measuredOn: dateSchema,
  pass: z.int().nonnegative(),
  warn: z.int().nonnegative(),
});
export type VerificationEvidence = z.infer<typeof verificationSchema>;

export const indexSchema = z.strictObject({
  format: z.literal(1),
  createdAt: timestampSchema,
  createdBy: text,
  handedOverOn: dateSchema,
  customer: z.strictObject({ id: text, name: text }),
  project: z.strictObject({ id: text, title: text }),
  commit: commitSchema,
  source: z.strictObject({ dir: text, bundle: sha256Schema, files: z.int(), bytes: z.int() }),
  materials: z.array(z.strictObject({ dir: text, files: z.int(), bytes: z.int() })),
  accounts: z.array(accountSchema),
  verification: verificationSchema,
  documents: z.array(text),
  /** 封をしたときの中身。handover.json 自身は含まない（SHA256SUMS に入れる）。 */
  files: z.array(fileSchema),
  sealedAt: timestampSchema.nullable(),
  restore: restoreSchema.nullable(),
});
export type HandoverIndex = z.infer<typeof indexSchema>;

const REJECTIONS: Record<string, string> = {
  missing: '検査レポートがありません',
  invalid: '検査レポートの形式が違います',
  inconsistent: '検査レポートの集計が合いません',
  'static-only': '静的検査だけのレポートです（ブラウザ実測を含む全項目の検査が要ります）',
  'has-failures': '検査に FAIL があります',
  'commit-unknown': '検査したコミットが分かりません',
  'other-commit': '引き渡すコミットと違うコミットの検査レポートです',
  'uncommitted-changes': '未コミットの変更があるときの検査レポートです',
};

/** 引渡しの根拠にできる検査レポートか。できないときは理由を添えて止める。 */
export function evidenceFrom(raw: unknown, commit: string): VerificationEvidence {
  const adoption = adoptReport(raw, { sha: commit, source: 'git', dirty: false });
  if (!adoption.ok)
    throw new OpsError(
      `検査の実績を引渡し資料に入れられません: ${REJECTIONS[adoption.reason] ?? adoption.reason}`,
    );
  const { pass, warn, measuredOn } = adoption.summary;
  return { commit, measuredOn, pass, warn };
}

/** 梱包したフォルダの中のファイル（除外するものを除く）。並びはパスの昇順。 */
export function packageFiles(dir: string, skip: readonly string[] = []): PackageFile[] {
  const walk = (current: string): string[] =>
    readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const full = join(current, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() ? [full] : [];
    });
  return walk(dir)
    .map((full) => relative(dir, full).split(sep).join('/'))
    .filter((path) => !skip.includes(path))
    .sort()
    .map((path) => ({ path, ...digest(join(dir, path)) }));
}

export const checksumsText = (files: readonly PackageFile[]) =>
  files.map((file) => `${file.sha256}  ${file.path}`).join('\n') + '\n';

/** SHA256SUMS と実際の中身が合うか。合わないファイルを返す（空なら封が保たれている）。 */
export function sealProblems(dir: string, checksums: string): string[] {
  const listed = new Map(
    checksums
      .split('\n')
      .filter(Boolean)
      .map((line) => [line.slice(66), line.slice(0, 64)] as const),
  );
  const actual = new Map(packageFiles(dir, [CHECKSUMS]).map((f) => [f.path, f.sha256] as const));
  return [
    ...[...listed.keys()].filter((path) => !actual.has(path)).map((path) => `足りない: ${path}`),
    ...[...actual.keys()].filter((path) => !listed.has(path)).map((path) => `覚えのない: ${path}`),
    ...[...actual.entries()]
      .filter(([path, sha]) => listed.has(path) && listed.get(path) !== sha)
      .map(([path]) => `中身が違う: ${path}`),
  ];
}

/** 同梱してはいけないもの（鍵・環境ファイル・秘密情報の形）を探す。 */
export function materialProblems(
  files: readonly { path: string; content: () => Buffer | null }[],
): string[] {
  const problems = excludedPaths(files.map((file) => file.path));
  for (const file of files) {
    const data = file.content();
    if (!data || data.includes(0)) continue;
    problems.push(...findSecrets(file.path, data.toString('utf8')));
  }
  return problems;
}

const accountRow = (a: Account): string[] => [
  ACCOUNT_KIND_LABELS[a.kind],
  a.service,
  `${ACCOUNT_HOLDER_LABELS[a.holder]}（${a.transferredOn ?? '—'}）`,
  a.ref,
  a.access === 'revoked'
    ? `${ACCOUNT_ACCESS_LABELS.revoked}（${a.revokedOn ?? '—'}）`
    : `${ACCOUNT_ACCESS_LABELS.retained}（${a.retainedReason ?? '—'}）`,
];

/** 顧客に渡す引渡し書。同梱物・名義・検査の実績・作り直す手順を 1 枚にまとめる。 */
export function handoverDocument(
  index: HandoverIndex,
  accounts: readonly Account[],
  issuer: Issuer,
): DocumentModel {
  const commit7 = index.commit.slice(0, 7);
  const bundle = `${SOURCE_DIR}/${index.source.dir}/repo.bundle`;
  const blocks: Block[] = [
    { kind: 'paragraph', text: `${index.customer.name} 様` },
    {
      kind: 'table',
      head: ['項目', '内容'],
      rows: [
        ['案件', `${index.project.title}（${index.project.id}）`],
        ['引渡し日', index.handedOverOn],
        ['担当', index.createdBy],
        ['対象のコミット', commit7],
        ...issuerRows(issuer),
      ],
    },
    { kind: 'heading', text: '同梱しているもの' },
    {
      kind: 'table',
      head: ['場所', '内容'],
      rows: [
        [
          bundle,
          `サイトのソースコード一式と、これまでの変更履歴（${index.source.files} ファイル）`,
        ],
        [
          `${SOURCE_DIR}/${index.source.dir}/manifest.json`,
          'ファイルごとの SHA-256（改変の確認用）',
        ],
        ...index.materials.map((m) => [
          `${MATERIALS_DIR}/${m.dir}/`,
          `写真などの元データ（${m.files} ファイル）`,
        ]),
        [`${DOCUMENT}.md・${DOCUMENT}.html`, 'この引渡し書'],
        [INDEX, '同梱物・名義・検査・再現の記録（機械可読）'],
        [CHECKSUMS, '同梱物すべての SHA-256'],
      ],
    },
    { kind: 'heading', text: 'ドメインなどの名義と、紬のアクセス' },
    {
      kind: 'table',
      head: ['種類', 'サービス', '名義（確認日）', '管理画面・登録先', '紬のアクセス'],
      rows: accounts.map(accountRow),
    },
    {
      kind: 'notice',
      text: 'パスワード・鍵・トークンは同梱していません。ログイン情報は、この資料とは別の経路でお渡しします。',
    },
    { kind: 'heading', text: '公開しているサイトの検査' },
    {
      kind: 'table',
      head: ['項目', '内容'],
      rows: [
        ['検査した日', index.verification.measuredOn],
        ['検査したコミット', commit7],
        ['結果', `PASS ${index.verification.pass}・WARN ${index.verification.warn}・FAIL 0`],
      ],
    },
    { kind: 'heading', text: '別のパソコン・別の会社で作り直す手順' },
    {
      kind: 'list',
      items: [
        `git clone ${bundle} tsumugi-site（履歴ごと取り出せます）`,
        `cd tsumugi-site && git checkout ${commit7}`,
        'Node.js を .nvmrc に書かれた版にします（nvm install && nvm use）',
        'npm ci（使っている部品を入れます）',
        'npm run build（out/ に HTML・CSS・画像の一式ができます）',
        'out/ の中身をそのまま置けば、同じサイトが表示されます（サーバー側の処理は要りません）',
      ],
    },
    ...(index.restore
      ? ([
          {
            kind: 'paragraph',
            text: `この手順は ${index.restore.checkedAt.slice(0, 10)} に別のフォルダで実行し、同梱のソースから同じ内容を作り直せることを確かめています（${index.restore.environment.node}／${index.restore.environment.platform}）。`,
          },
        ] as Block[])
      : []),
    { kind: 'heading', text: 'お困りのとき' },
    {
      kind: 'paragraph',
      text: `この資料の中身や手順について分からないことがあれば、${issuer.email}（電話 ${issuer.tel}）までご連絡ください。`,
    },
  ];
  return { title: '引渡し書', blocks };
}

/** 引渡し書（Markdown と印刷用 HTML）を書く。封の前後で同じ関数から作る。 */
export function writeDocuments(dir: string, index: HandoverIndex): void {
  const document = handoverDocument(index, index.accounts, siteIssuer());
  writeText(join(dir, `${DOCUMENT}.md`), renderMarkdown(document));
  writeText(join(dir, `${DOCUMENT}.html`), renderHtml(document));
}

/**
 * 封をする。引渡し書を作り直し、handover.json に中身の一覧を入れ、SHA256SUMS を最後に書く。
 * SHA256SUMS は handover.json 自身も含む（資料全体が後から変わっていないかを確かめられる）。
 */
export function seal(dir: string, index: HandoverIndex): HandoverIndex {
  const sealed: HandoverIndex = { ...index, sealedAt: new Date().toISOString(), files: [] };
  writeDocuments(dir, sealed);
  const withFiles: HandoverIndex = { ...sealed, files: packageFiles(dir, [INDEX, CHECKSUMS]) };
  writeJson(join(dir, INDEX), withFiles);
  writeText(join(dir, CHECKSUMS), checksumsText(packageFiles(dir, [CHECKSUMS])));
  return withFiles;
}

/** フォルダの中のファイル数と合計バイト数（元素材の目録用）。 */
export function folderTotals(dir: string): { files: number; bytes: number } {
  const files = packageFiles(dir);
  return { files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
}

export const isDirectory = (path: string) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};
