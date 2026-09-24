import { appendVersion, estimateInputSchema } from '../../tools/ops/estimate/model';
import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJson } from '../../tools/ops/shared/store';
import {
  type CustomerFile,
  addConsultation,
  addProject,
  advanceProject,
  blockersFor,
  completeChecklistItem,
  createCustomer,
  linkEstimate,
  loadCustomer,
  recordAccount,
  recordApproval,
  recordContract,
  recordHandover,
} from '../../tools/ops/crm/model';

const estimate = appendVersion(
  null,
  estimateInputSchema.parse(
    JSON.parse(
      readFileSync(
        new URL('../../tools/ops/fixtures/estimate-basic.json', import.meta.url),
        'utf8',
      ),
    ),
  ),
  { savedAt: '2026-09-16T10:00:00+09:00', today: '2026-09-16' },
).versions[0]!;
const m = { at: '2026-09-16T10:00:00+09:00', by: 'サンプル担当' };
const decided = { decidedBy: 'サンプル顧客', decidedOn: '2026-09-20' };
const fresh = () =>
  addProject(
    addConsultation(
      createCustomer({ customerId: 'sample-shop', name: '架空の商店', owner: 'サンプル担当' }, m),
      { channel: '電話', summary: 'サイトの作り直しの相談（サンプル）' },
      m,
    ),
    { id: 'site-2026', title: 'サイト制作（サンプル）' },
    m,
  );
const project = (file: CustomerFile) => file.projects[0]!;

/** 各段階の前提を満たしながら、指定の状態まで進める。 */
const through = (stop: string) => {
  let f = fresh();
  const step = (to: string) => {
    f = advanceProject(f, 'site-2026', to, m);
    return to === stop;
  };
  f = linkEstimate(f, 'site-2026', { ...estimate, version: 2 }, m);
  if (step('estimate_sent')) return f;
  f = recordContract(
    f,
    'site-2026',
    { version: 1, status: 'signed', ref: 'sample-contract-v1', signedOn: '2026-09-18' },
    m,
  );
  if (step('contracted')) return f;
  if (step('in_production')) return f;
  f = recordApproval(
    f,
    'site-2026',
    { id: 'copy-top', kind: 'copy', item: 'トップの原稿', status: 'approved', ...decided },
    m,
  );
  f = recordApproval(
    f,
    'site-2026',
    { id: 'photo-set', kind: 'photo', item: '店内写真', status: 'approved', ...decided },
    m,
  );
  if (step('awaiting_acceptance')) return f;
  for (const key of ['verify-fail-zero', 'domain-customer-name', 'no-secrets-in-source'])
    f = completeChecklistItem(
      f,
      'site-2026',
      { key, doneOn: '2026-09-25', by: 'サンプル担当', evidence: `サンプルの根拠 ${key}` },
      m,
    );
  if (step('accepted')) return f;
  // ドメインとホスティングがお客様名義になるまで引き渡さない（ADR 0082）。
  f = recordAccount(
    f,
    'site-2026',
    {
      id: 'domain',
      kind: 'domain',
      service: 'お名前.com',
      holder: 'customer',
      ref: 'お客様のアカウント',
      transferredOn: '2026-09-25',
      access: 'revoked',
      revokedOn: '2026-09-26',
    },
    m,
  );
  f = recordAccount(
    f,
    'site-2026',
    {
      id: 'hosting',
      kind: 'hosting',
      service: 'Vercel',
      holder: 'customer',
      ref: 'お客様のアカウント',
      transferredOn: '2026-09-25',
      access: 'retained',
      retainedReason: '継続支援の契約があるため',
    },
    m,
  );
  for (const item of ['source_code', 'manual', 'photos'])
    f = recordHandover(
      f,
      'site-2026',
      item,
      { recordedOn: '2026-09-26', by: 'サンプル担当', ref: `sample:${item}` },
      m,
    );
  f = recordHandover(
    f,
    'site-2026',
    'github_invite',
    { recordedOn: '2026-09-26', by: 'サンプル担当', ref: 'sample-account', permission: 'read' },
    m,
  );
  step('handed_over');
  return f;
};

describe('案件の状態遷移', () => {
  it('相談から引渡しまで、前提を満たせば進み、履歴が残る', () => {
    const f = through('handed_over');
    expect(project(f).state).toBe('handed_over');
    expect(project(f).stateHistory.map((h) => h.to)).toEqual([
      'consulting',
      'estimate_sent',
      'contracted',
      'in_production',
      'awaiting_acceptance',
      'accepted',
      'handed_over',
    ]);
    expect(f.history.length).toBeGreaterThan(10);
  });

  it('見積・契約がなければ見積提出・契約済みに進めない', () => {
    expect(blockersFor(project(fresh()), 'estimate_sent')).toEqual(['見積の版が紐付いていません']);
    const sent = through('estimate_sent');
    expect(blockersFor(project(sent), 'contracted')).toEqual(['締結済みの契約がありません']);
    const draft = recordContract(sent, 'site-2026', { version: 1, status: 'sent', ref: 'x' }, m);
    expect(() => advanceProject(draft, 'site-2026', 'contracted', m)).toThrow('締結済みの契約');
    expect(() =>
      recordContract(sent, 'site-2026', { version: 2, status: 'signed', ref: 'x' }, m),
    ).toThrow('締結日');
  });

  it('原稿・写真の承認がそろわなければ検収待ちにしない', () => {
    let f = through('in_production');
    expect(blockersFor(project(f), 'awaiting_acceptance')).toEqual([
      '原稿の承認記録がありません',
      '写真の承認記録がありません',
    ]);
    f = recordApproval(
      f,
      'site-2026',
      {
        id: 'copy-top',
        kind: 'copy',
        item: 'トップの原稿',
        status: 'changes_requested',
        ...decided,
      },
      m,
    );
    expect(blockersFor(project(f), 'awaiting_acceptance')).toContain(
      '原稿「トップの原稿」が未承認です',
    );
    expect(() =>
      recordApproval(f, 'site-2026', { id: 'p', kind: 'photo', item: 'x', status: 'approved' }, m),
    ).toThrow('判断者と日付');
  });

  it('納品チェックが未完了なら検収済みにせず、根拠のない完了を拒否する', () => {
    const f = through('awaiting_acceptance');
    expect(blockersFor(project(f), 'accepted')).toHaveLength(3);
    expect(() =>
      completeChecklistItem(
        f,
        'site-2026',
        { key: 'verify-fail-zero', doneOn: '2026-09-25', by: 'x', evidence: '' },
        m,
      ),
    ).toThrow('根拠');
    expect(() =>
      completeChecklistItem(
        f,
        'site-2026',
        { key: 'unknown', doneOn: '2026-09-25', by: 'x', evidence: 'x' },
        m,
      ),
    ).toThrow('項目がありません');
  });

  it('引渡しは検収後だけ。GitHub は閲覧権限だけ。4 点そろうまで引渡し済みにしない', () => {
    expect(() =>
      recordHandover(
        through('awaiting_acceptance'),
        'site-2026',
        'manual',
        { recordedOn: '2026-09-26', by: 'x', ref: 'x' },
        m,
      ),
    ).toThrow('検収済み');
    const f = through('accepted');
    expect(() =>
      recordHandover(
        f,
        'site-2026',
        'github_invite',
        { recordedOn: '2026-09-26', by: 'x', ref: 'x', permission: 'write' },
        m,
      ),
    ).toThrow('閲覧');
    const partial = recordHandover(
      f,
      'site-2026',
      'source_code',
      { recordedOn: '2026-09-26', by: 'x', ref: 'x' },
      m,
    );
    expect(blockersFor(project(partial), 'handed_over')).toEqual([
      'ドメインのアカウントが未記録です',
      'ホスティングのアカウントが未記録です',
      '引き継ぎ手順書の引渡しが未記録です',
      '写真の元データの引渡しが未記録です',
      'GitHub の閲覧招待の引渡しが未記録です',
    ]);
  });

  it('飛ばす遷移、終わった案件の変更を拒否する', () => {
    expect(() => advanceProject(fresh(), 'site-2026', 'in_production', m)).toThrow(
      '進められません',
    );
    const lost = advanceProject(fresh(), 'site-2026', 'closed_lost', m);
    expect(() => linkEstimate(lost, 'site-2026', estimate, m)).toThrow('変更しません');
    expect(() => advanceProject(lost, 'site-2026', 'consulting', m)).toThrow('進められません');
  });
});

describe('顧客の分離', () => {
  it('ファイル名と中身の顧客 ID が違えば読み込まない', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ops-crm-'));
    try {
      writeJson(join(dir, 'crm', 'sample-shop.json'), { ...fresh(), customerId: 'other-shop' });
      expect(() => loadCustomer(dir, 'sample-shop')).toThrow('顧客 ID が一致しません');
      expect(loadCustomer(dir, 'nobody')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
