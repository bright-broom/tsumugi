import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackup } from '../../tools/ops/backup';
import {
  type Account,
  type CustomerFile,
  addConsultation,
  addProject,
  advanceProject,
  blockersFor,
  completeChecklistItem,
  createCustomer,
  linkEstimate,
  recordAccount,
  recordApproval,
  recordContract,
  transferBlockers,
} from '../../tools/ops/crm/model';
import {
  type EstimateFile,
  appendVersion,
  estimateInputSchema,
} from '../../tools/ops/estimate/model';
import {
  CHECKSUMS,
  INDEX,
  type HandoverIndex,
  checksumsText,
  evidenceFrom,
  handoverDocument,
  indexSchema,
  materialProblems,
  packageFiles,
  seal,
  sealProblems,
} from '../../tools/ops/handover/model';
import { renderHtml, renderMarkdown } from '../../tools/ops/shared/document';
import { siteIssuer } from '../../tools/ops/shared/issuer';
import { restoreTest } from '../../tools/ops/restore';

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const tempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
};

const m = { at: '2026-09-24T10:00:00+09:00', by: 'サンプル担当' };
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../tools/ops/fixtures/${name}`, import.meta.url), 'utf8'));
const estimates: EstimateFile = appendVersion(
  null,
  estimateInputSchema.parse(fixture('estimate-basic.json')),
  { savedAt: '2026-09-16T10:00:00+09:00', today: '2026-09-16' },
);

const account = (over: Partial<Account> = {}): Account =>
  ({
    id: 'domain',
    kind: 'domain',
    service: 'お名前.com',
    holder: 'customer',
    ref: 'お客様のアカウント（管理画面）',
    transferredOn: '2026-09-20',
    access: 'revoked',
    revokedOn: '2026-09-24',
    ...over,
  }) as Account;

/** 検収済みまで進めた架空の顧客。 */
function acceptedCustomer(): CustomerFile {
  let f = addProject(
    addConsultation(
      createCustomer({ customerId: 'sample-shop', name: '架空の商店', owner: 'サンプル担当' }, m),
      { channel: '電話', summary: '相談（サンプル）' },
      m,
    ),
    { id: 'site-2026', title: 'サイト制作（サンプル）' },
    m,
  );
  f = linkEstimate(f, 'site-2026', estimates.versions[0]!, m);
  f = advanceProject(f, 'site-2026', 'estimate_sent', m);
  f = recordContract(
    f,
    'site-2026',
    { version: 1, status: 'signed', ref: 'sample-contract', signedOn: '2026-09-17' },
    m,
  );
  f = advanceProject(f, 'site-2026', 'contracted', m);
  f = advanceProject(f, 'site-2026', 'in_production', m);
  const decided = { decidedBy: 'サンプル顧客', decidedOn: '2026-09-20' };
  f = recordApproval(
    f,
    'site-2026',
    { id: 'copy', kind: 'copy', item: '原稿', status: 'approved', ...decided },
    m,
  );
  f = recordApproval(
    f,
    'site-2026',
    { id: 'photo', kind: 'photo', item: '写真', status: 'approved', ...decided },
    m,
  );
  f = advanceProject(f, 'site-2026', 'awaiting_acceptance', m);
  for (const key of ['verify-fail-zero', 'domain-customer-name', 'no-secrets-in-source'])
    f = completeChecklistItem(
      f,
      'site-2026',
      { key, doneOn: '2026-09-24', by: 'サンプル担当', evidence: `根拠 ${key}` },
      m,
    );
  return advanceProject(f, 'site-2026', 'accepted', m);
}
const project = (file: CustomerFile) => file.projects[0]!;

describe('名義とアクセスの記録', () => {
  it('ドメインとホスティングがお客様名義になるまで引き渡さない', () => {
    const accepted = acceptedCustomer();
    expect(transferBlockers(project(accepted))).toEqual([
      'ドメインのアカウントが未記録です',
      'ホスティングのアカウントが未記録です',
    ]);
    const tsumugiHeld = recordAccount(
      accepted,
      'site-2026',
      account({ holder: 'tsumugi', transferredOn: undefined }),
      m,
    );
    expect(transferBlockers(project(tsumugiHeld))).toContain(
      'ドメイン「お名前.com」がお客様名義ではありません（紬名義）',
    );
    const both = recordAccount(
      recordAccount(accepted, 'site-2026', account(), m),
      'site-2026',
      account({
        id: 'hosting',
        kind: 'hosting',
        service: 'Vercel',
        access: 'retained',
        revokedOn: undefined,
        retainedReason: '継続支援の契約があるため',
      }),
      m,
    );
    expect(transferBlockers(project(both))).toEqual([]);
    // 引渡しの記録そのものは、資料を渡してから残す（transferBlockers には含めない）。
    expect(blockersFor(project(both), 'handed_over')).toEqual([
      'ソースコード一式の引渡しが未記録です',
      '引き継ぎ手順書の引渡しが未記録です',
      '写真の元データの引渡しが未記録です',
      'GitHub の閲覧招待の引渡しが未記録です',
    ]);
  });

  it('記録の形が揃わないもの、パスワードらしき文字列は受け付けない', () => {
    const accepted = acceptedCustomer();
    const bad = (over: Partial<Account>) =>
      expect(() => recordAccount(accepted, 'site-2026', account(over), m)).toThrow();
    bad({ transferredOn: undefined });
    bad({ holder: 'tsumugi' });
    bad({ revokedOn: undefined });
    bad({ access: 'retained' });
    bad({ access: 'retained', revokedOn: undefined, retainedReason: undefined });
    expect(() =>
      recordAccount(accepted, 'site-2026', account({ ref: 'admin / パスワードは Pw123456' }), m),
    ).toThrow('パスワード');
    expect(() =>
      recordAccount(accepted, 'site-2026', account({ note: 'api_key を共有済み' }), m),
    ).toThrow('別の経路');
  });
});

const report = (over: Record<string, unknown> = {}) => {
  const results = [
    { level: 'PASS', check: '01 検査', page: '-', detail: '合格' },
    { level: 'WARN', check: '02 検査', page: '-', detail: '未確認' },
  ];
  return {
    schemaVersion: 1,
    kind: 'full',
    mode: 'production',
    measuredAt: '2026-09-24T01:00:00.000Z',
    commit: { sha: 'a'.repeat(40), source: 'git', dirty: false },
    artifact: { files: 22, sha256: 'b'.repeat(64) },
    counts: { pass: 1, warn: 1, fail: 0, notApplicable: 0 },
    verdict: 'deliverable',
    lcp: null,
    acceptance: [],
    results,
    ...over,
  };
};

describe('検査の実績', () => {
  it('全項目・FAIL 0・同じコミットの検査だけを引渡しの根拠にする', () => {
    expect(evidenceFrom(report(), 'a'.repeat(40))).toEqual({
      commit: 'a'.repeat(40),
      measuredOn: '2026-09-24',
      pass: 1,
      warn: 1,
    });
    expect(() => evidenceFrom(report(), 'c'.repeat(40))).toThrow('違うコミット');
    expect(() => evidenceFrom(report({ kind: 'static' }), 'a'.repeat(40))).toThrow('静的検査だけ');
    expect(() =>
      evidenceFrom(
        report({
          counts: { pass: 1, warn: 1, fail: 1, notApplicable: 0 },
          verdict: 'blocked',
          results: [
            { level: 'PASS', check: '01 検査', page: '-', detail: '合格' },
            { level: 'WARN', check: '02 検査', page: '-', detail: '未確認' },
            { level: 'FAIL', check: '03 検査', page: '-', detail: '不合格' },
          ],
        }),
        'a'.repeat(40),
      ),
    ).toThrow('FAIL');
    expect(() =>
      evidenceFrom(
        report({ commit: { sha: 'a'.repeat(40), source: 'git', dirty: true } }),
        'a'.repeat(40),
      ),
    ).toThrow('未コミット');
    expect(() => evidenceFrom({ broken: true }, 'a'.repeat(40))).toThrow('形式');
  });
});

describe('同梱してはいけないもの', () => {
  it('鍵・環境ファイル・秘密情報の形を見つけたら梱包しない', () => {
    const material = (path: string, content: string) => ({
      path,
      content: () => Buffer.from(content),
    });
    expect(
      materialProblems([
        material('photos/店内.jpg.txt', '写真の説明'),
        material('.env.local', 'SECRET=1'),
        material('deploy.key', 'x'),
        material('notes.txt', ['-----BEGIN ', 'PRIVATE KEY-----'].join('')),
      ]),
    ).toEqual([
      '.env.local（.env*（.env.example を除く））',
      'deploy.key（鍵・証明書ファイル（*.pem・*.key・*.p12・*.pfx））',
      'notes.txt: 秘密鍵の形の文字列',
    ]);
    expect(materialProblems([material('photos/店内.jpg.txt', '写真の説明')])).toEqual([]);
  });
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    'git',
    [
      '-c',
      'user.name=handover-test',
      '-c',
      'user.email=handover-test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8' },
  );

/** バンドルを作れる小さなリポジトリ。 */
function fixtureRepo() {
  const repo = tempDir('tsumugi-handover-repo-');
  git(repo, 'init', '--quiet', '-b', 'main');
  writeFileSync(join(repo, 'index.html'), '<!doctype html><title>店の名前</title>\n');
  mkdirSync(join(repo, 'docs'));
  writeFileSync(join(repo, 'docs', 'README.md'), '# 手順\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '--quiet', '-m', 'first');
  return { repo, commit: git(repo, 'rev-parse', 'HEAD').trim() };
}

function packageFor(accounts: readonly Account[] = [account()]) {
  const { repo, commit } = fixtureRepo();
  const dir = join(tempDir('tsumugi-handover-pkg-'), 'package');
  mkdirSync(dir);
  const { dir: sourceDir, manifest } = createBackup({ root: repo, outDir: join(dir, 'source') });
  const index: HandoverIndex = indexSchema.parse({
    format: 1,
    createdAt: '2026-09-24T19:00:00+09:00',
    createdBy: 'サンプル担当',
    handedOverOn: '2026-09-24',
    customer: { id: 'sample-shop', name: '架空の商店' },
    project: { id: 'site-2026', title: 'サイト制作（サンプル）' },
    commit,
    source: {
      dir: sourceDir.split('/').at(-1),
      bundle: manifest.bundle.sha256,
      files: manifest.files.length,
      bytes: manifest.files.reduce((sum, f) => sum + f.bytes, 0),
    },
    materials: [],
    accounts,
    verification: { commit, measuredOn: '2026-09-24', pass: 347, warn: 3 },
    documents: ['handover.md', 'handover.html'],
    files: [],
    sealedAt: null,
    restore: null,
  });
  return { repo, dir, sourceDir, index };
}

describe('引渡し書', () => {
  it('同梱物・名義・検査の実績・作り直す手順を載せ、パスワードは同梱しないと書く', () => {
    const { index } = packageFor([
      account(),
      account({
        id: 'hosting',
        kind: 'hosting',
        service: 'Vercel',
        access: 'retained',
        revokedOn: undefined,
        retainedReason: '継続支援の契約があるため',
      }),
    ]);
    const markdown = renderMarkdown(handoverDocument(index, index.accounts, siteIssuer()));
    expect(markdown).toContain('架空の商店 様');
    expect(markdown).toContain('ドメイン | お名前.com | お客様名義（2026-09-20）');
    expect(markdown).toContain('保持（継続支援の契約があるため）');
    expect(markdown).toContain('PASS 347・WARN 3・FAIL 0');
    expect(markdown).toContain('npm run build');
    expect(markdown).toContain('パスワード・鍵・トークンは同梱していません');
    // 引渡し書は印刷して渡す。実行時の JavaScript は入れない（ADR 0036）。
    const html = renderHtml(handoverDocument(index, index.accounts, siteIssuer()));
    expect(html).not.toContain('<script');
  });
});

describe('封（SHA256SUMS）', () => {
  it('作り直せたときだけ封をし、あとから中身が変わると分かる', () => {
    const { dir, index } = packageFor();
    const sealed = seal(dir, {
      ...index,
      restore: {
        checkedAt: '2026-09-24T19:10:00+09:00',
        ok: true,
        totalMs: 1200,
        deps: 'none',
        build: 'none',
        environment: { node: 'v24.0.0', platform: 'darwin', arch: 'arm64' },
        steps: [{ name: 'チェックサムの照合', ok: true, ms: 10 }],
      },
    });
    expect(sealed.sealedAt).not.toBeNull();
    expect(sealed.files.map((f) => f.path)).toContain('handover.md');
    expect(sealed.files.some((f) => f.path === INDEX || f.path === CHECKSUMS)).toBe(false);
    // 封は handover.json 自身も含む。
    const checksums = readFileSync(join(dir, CHECKSUMS), 'utf8');
    expect(checksums).toContain(`  ${INDEX}`);
    expect(sealProblems(dir, checksums)).toEqual([]);
    // 引渡し書には、作り直せたことが書かれる。
    expect(readFileSync(join(dir, 'handover.md'), 'utf8')).toContain('2026-09-24 に別のフォルダで');

    writeFileSync(join(dir, 'handover.md'), '書き換えた\n');
    expect(sealProblems(dir, checksums)).toEqual(['中身が違う: handover.md']);
    writeFileSync(join(dir, 'extra.txt'), 'あとから入れた\n');
    expect(sealProblems(dir, checksums)).toContain('覚えのない: extra.txt');
    rmSync(join(dir, 'handover.html'));
    expect(sealProblems(dir, checksums)).toContain('足りない: handover.html');
  });

  it('封のとおりのソースから、別のフォルダで同じ中身を取り出せる', () => {
    const { dir, index } = packageFor();
    const sealed = seal(dir, index);
    expect(sealProblems(dir, readFileSync(join(dir, CHECKSUMS), 'utf8'))).toEqual([]);
    const restored = restoreTest({
      backupDir: join(dir, 'source', sealed.source.dir),
      workDir: tempDir('tsumugi-handover-restore-'),
      deps: 'none',
      build: 'none',
    });
    expect(restored.ok).toBe(true);
    expect(restored.commit).toBe(index.commit);
    expect(restored.steps.filter((s) => s.ok)).toHaveLength(restored.steps.length);
  });

  it('資料の一覧は、並びが決まっていて、封の対象と同じ', () => {
    const { dir } = packageFor();
    const files = packageFiles(dir, [CHECKSUMS]);
    expect(files.map((f) => f.path)).toEqual([...files.map((f) => f.path)].sort());
    expect(checksumsText(files).trim().split('\n')).toHaveLength(files.length);
  });
});
