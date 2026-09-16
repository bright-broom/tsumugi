import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import * as C from '@/content/config';
import { getMessages } from '@/i18n/catalog';
import { pendingHumanChecks } from '../tools/verify/acceptance';
import {
  catalogSha256,
  endpointProblem,
  evaluatePublication,
  placeholderProblem,
  publicationSnapshot,
  resolveMode,
  type PublicationSnapshot,
} from '../tools/verify/publication';
import type { Result } from '../tools/verify/results';

const TODAY = '2026-09-17';
const HASH = 'f'.repeat(64);

/** 公開条件をすべて満たした設定（テスト用の架空の値） */
function ready(overrides: Partial<PublicationSnapshot> = {}): PublicationSnapshot {
  return {
    placeholder: false,
    fields: [
      { key: 'DOMAIN', kind: 'domain', value: 'shop-fixture.jp' },
      { key: 'TEL', kind: 'tel', value: '080-4560-1124' },
      { key: 'EMAIL', kind: 'email', value: 'info@shop-fixture.jp' },
      { key: 'POSTAL_CODE', kind: 'postal', value: '100-0001' },
      { key: 'ADDRESS_REGION', kind: 'text', value: '東京都' },
      { key: 'ADDRESS_CITY', kind: 'text', value: '千代田区' },
      { key: 'ADDRESS_STREET', kind: 'text', value: '千代田1-1' },
      { key: 'LEGAL_NAME', kind: 'text', value: '架空商店' },
      { key: 'MEMBERS[0].name', kind: 'text', value: '見本 太郎' },
      { key: 'MEMBERS[0].bio', kind: 'text', value: '設計と実装を担当します。' },
    ],
    contactMethod: 'form',
    formEndpoint: 'https://forms.shop-fixture.jp/inquiry',
    approvals: [
      {
        id: 'terms',
        record: { version: 'v1', approvedOn: '2026-09-01', reviewerRole: 'attorney', catalogSha256: HASH },
        currentSha256: HASH,
      },
    ],
    humanChecksPending: [],
    ...overrides,
  };
}
const withField = (key: string, value: string) =>
  ready().fields.map((f) => (f.key === key ? { ...f, value } : f));
const failed = (rs: Result[]) => rs.filter((r) => r.level === 'FAIL').map((r) => r.page);
const levels = (rs: Result[]) => rs.map((r) => r.level);

describe('検査モード', () => {
  it('既定はプレビュー。Vercel の本番配備（VERCEL_ENV=production）では本番になる', () => {
    expect(resolveMode(undefined, {})).toEqual({ mode: 'preview' });
    expect(resolveMode(undefined, { VERCEL_ENV: 'preview' })).toEqual({ mode: 'preview' });
    expect(resolveMode(undefined, { VERCEL_ENV: 'production' })).toEqual({ mode: 'production' });
    expect(resolveMode('production', {})).toEqual({ mode: 'production' });
  });
  it('本番の配備でプレビューを指定したり、値が不正だったりすれば止める', () => {
    expect(resolveMode('preview', { VERCEL_ENV: 'production' })).toHaveProperty('error');
    expect(resolveMode('prod', {})).toHaveProperty('error');
    expect(resolveMode(null, {})).toHaveProperty('error');
  });
});

describe('仮の値の判定', () => {
  it.each([
    ['tel', '000-0000-0000'],
    ['tel', '12345'],
    ['domain', 'example.jp'],
    ['domain', 'example.com'],
    ['domain', 'shop.test'],
    ['domain', 'not a domain'],
    ['email', 'info@example.jp'],
    ['email', 'info'],
    ['postal', '000-0000'],
    ['postal', '1000001'],
    ['text', '（名前）'],
    ['text', '（都道府県）'],
    ['text', '〇〇株式会社'],
    ['text', '担当者のプロフィールは準備中です。'],
    ['text', '   '],
  ] as const)('%s「%s」は公開に使えない', (kind, value) => {
    expect(placeholderProblem(kind, value)).not.toBeNull();
  });
  it.each([
    ['tel', '080-4560-1124'],
    ['tel', '03-1234-5678'],
    ['domain', 'shop-fixture.jp'],
    ['email', 'info@shop-fixture.jp'],
    ['postal', '100-0001'],
    ['text', '千代田1-1（見本ビル2階）'],
  ] as const)('%s「%s」は使える', (kind, value) => {
    expect(placeholderProblem(kind, value)).toBeNull();
  });
  it('問い合わせの送信先は https の URL か、同じサイトの絶対パスだけ', () => {
    expect(endpointProblem('')).not.toBeNull();
    expect(endpointProblem('http://forms.shop-fixture.jp/')).not.toBeNull();
    expect(endpointProblem('https://forms.example.com/x')).not.toBeNull();
    expect(endpointProblem('//forms.shop-fixture.jp/')).not.toBeNull();
    expect(endpointProblem('https://forms.shop-fixture.jp/inquiry')).toBeNull();
    expect(endpointProblem('/api/inquiry')).toBeNull();
  });
});

describe('本番の不備を通さない', () => {
  it('条件をすべて満たせば、本番もプレビューも FAIL しない', () => {
    const production = evaluatePublication(ready(), 'production', TODAY);
    expect(failed(production)).toEqual([]);
    expect(production.length).toBe(1 + ready().fields.length + 1 + 1 + 1);
    expect(levels(evaluatePublication(ready(), 'preview', TODAY))).toEqual(['PASS']);
  });

  it.each<[string, PublicationSnapshot]>([
    ['PLACEHOLDER', ready({ placeholder: true })],
    ['TEL', ready({ fields: withField('TEL', '000-0000-0000') })],
    ['DOMAIN', ready({ fields: withField('DOMAIN', 'example.jp') })],
    ['EMAIL', ready({ fields: withField('EMAIL', 'info@example.jp') })],
    ['POSTAL_CODE', ready({ fields: withField('POSTAL_CODE', '000-0000') })],
    ['ADDRESS_STREET', ready({ fields: withField('ADDRESS_STREET', '（番地）') })],
    ['MEMBERS[0].name', ready({ fields: withField('MEMBERS[0].name', '（名前）') })],
    ['FORM_ENDPOINT', ready({ formEndpoint: '' })],
    [
      'LEGAL_APPROVALS.terms',
      ready({
        approvals: [
          { id: 'terms', record: { version: null, approvedOn: null, reviewerRole: null, catalogSha256: null }, currentSha256: HASH },
        ],
      }),
    ],
    [
      'LEGAL_APPROVALS.terms',
      ready({
        approvals: [
          { id: 'terms', record: { version: 'v1', approvedOn: '2026-09-01', reviewerRole: null, catalogSha256: HASH }, currentSha256: HASH },
        ],
      }),
    ],
    ['ACCEPTANCE_RECORDS', ready({ humanChecksPending: ['notifications', 'business-profile'] })],
  ])('本番モードは %s の不足を FAIL にする', (target, snapshot) => {
    expect(failed(evaluatePublication(snapshot, 'production', TODAY))).toEqual([target]);
  });

  it('プレビューは仮の設定のままでも確認でき、本番の不足を WARN 1 件にまとめる', () => {
    const draft = ready({
      placeholder: true,
      fields: withField('TEL', '000-0000-0000'),
      formEndpoint: '',
      approvals: [
        { id: 'terms', record: { version: null, approvedOn: null, reviewerRole: null, catalogSha256: null }, currentSha256: HASH },
      ],
      humanChecksPending: ['notifications'],
    });
    const preview = evaluatePublication(draft, 'preview', TODAY);
    expect(levels(preview)).toEqual(['WARN']);
    for (const target of ['PLACEHOLDER', 'TEL', 'FORM_ENDPOINT', 'LEGAL_APPROVALS.terms', 'ACCEPTANCE_RECORDS'])
      expect(preview[0]!.detail).toContain(target);
  });

  it('プレビューでも、PLACEHOLDER=false で仮の値が残っていれば FAIL（従来の検査を維持）', () => {
    const preview = evaluatePublication(ready({ fields: withField('EMAIL', 'info@example.jp') }), 'preview', TODAY);
    expect(failed(preview)).toEqual(['EMAIL']);
  });

  it('承認後に文面が変わった・承認日が不正な記録は、ページが「確認済み」に見えるのでプレビューでも FAIL', () => {
    const changed = ready({
      approvals: [
        { id: 'terms', record: { version: 'v1', approvedOn: '2026-09-01', reviewerRole: 'attorney', catalogSha256: HASH }, currentSha256: 'e'.repeat(64) },
      ],
    });
    const future = ready({
      approvals: [
        { id: 'terms', record: { version: 'v1', approvedOn: '2026-12-31', reviewerRole: 'attorney', catalogSha256: HASH }, currentSha256: HASH },
      ],
    });
    for (const snapshot of [changed, future]) {
      expect(failed(evaluatePublication(snapshot, 'preview', TODAY))).toEqual(['LEGAL_APPROVALS.terms']);
      expect(failed(evaluatePublication({ ...snapshot, placeholder: true }, 'preview', TODAY))).toEqual([
        'LEGAL_APPROVALS.terms',
      ]);
    }
  });
});

describe('いまの設定', () => {
  const snapshot = publicationSnapshot(pendingHumanChecks(TODAY));

  it('プレビューとしては検査を通る（npm run verify の既定）', () => {
    expect(failed(evaluatePublication(snapshot, 'preview', TODAY))).toEqual([]);
  });

  it('自社公開の指示は専門家確認や納品検収の完了に置き換えない', () => {
    const results = evaluatePublication(snapshot, 'production', TODAY);
    expect(failed(results)).toEqual([]);
    expect(results.filter((r) => r.level === 'WARN').map((r) => r.page))
      .toEqual(['LEGAL_APPROVALS.terms', 'LEGAL_APPROVALS.legal', 'ACCEPTANCE_RECORDS']);
    expect(C.PLACEHOLDER).toBe(false);
    for (const id of ['terms', 'legal'] as const)
      expect(C.isApprovalRecorded(C.LEGAL_APPROVALS[id])).toBe(false);
  });

  it('承認の対象は文面ごとの SHA-256 で区別する', () => {
    expect(catalogSha256('terms')).toMatch(/^[0-9a-f]{64}$/);
    expect(catalogSha256('terms')).not.toBe(catalogSha256('legal'));
  });

  it('承認記録が揃うまで、terms.html は下書きの注意を出し続ける', () => {
    expect(C.isApprovalRecorded({ version: null, approvedOn: null, reviewerRole: null, catalogSha256: null })).toBe(false);
    expect(C.isApprovalRecorded({ version: 'v1', approvedOn: '2026-09-01', reviewerRole: 'attorney', catalogSha256: ' ' })).toBe(false);
    expect(C.isApprovalRecorded({ version: 'v1', approvedOn: '2026-09-01', reviewerRole: 'attorney', catalogSha256: HASH })).toBe(true);
    const html = renderToStaticMarkup(<Page {...pageProps('terms')} />);
    if (C.PLACEHOLDER || !C.isApprovalRecorded(C.LEGAL_APPROVALS.terms))
      expect(html).toContain(getMessages().terms.heading2);
  });
});

it('メール受付はフォーム送信先を要求せず、有効なメール窓口を要求する', () => {
  const snapshot = ready({ contactMethod: 'email', formEndpoint: '' });
  expect(failed(evaluatePublication(snapshot, 'production', TODAY))).toEqual([]);
  expect(failed(evaluatePublication({ ...snapshot, fields: withField('EMAIL', '') }, 'production', TODAY)))
    .toEqual(['EMAIL', 'CONTACT_EMAIL']);
});

it('公開中の問い合わせはメールアドレスを表示し、フォームを開かない', () => {
  const html = renderToStaticMarkup(<Page {...pageProps('contact')} />);
  expect(html).toContain('href="mailto:leonardodavinci.works@gmail.com"');
  expect(html).toContain('leonardodavinci.works@gmail.com</a>');
  expect(html).not.toContain('<form');
  expect(html).not.toContain('送信（未設定）');
});


describe('自社公開の承認の範囲', () => {
  const snapshot = () => publicationSnapshot(pendingHumanChecks(TODAY));

  it('公開承認を削除すると専門家・受入確認を再び必須にする', () => {
    expect(failed(evaluatePublication({ ...snapshot(), ownerPublication: null }, 'production', TODAY)))
      .toEqual(['LEGAL_APPROVALS.terms', 'LEGAL_APPROVALS.legal', 'ACCEPTANCE_RECORDS']);
  });

  it.each(['DOMAIN', 'LEGAL_NAME'])('別の %s へ承認を持ち越さない', (key) => {
    const state = snapshot();
    state.fields = state.fields.map((f) => f.key === key ? { ...f, value: 'other-company.jp' } : f);
    expect(failed(evaluatePublication(state, 'production', TODAY))).toContain('OWNER_PUBLICATION');
    expect(failed(evaluatePublication(state, 'preview', TODAY))).toContain('OWNER_PUBLICATION');
  });

  it.each(['2026-02-30', '2027-01-01', 'invalid'])('不正・未来の日付 %s は拒否する', (authorizedOn) => {
    const state = snapshot();
    state.ownerPublication = { ...state.ownerPublication!, authorizedOn };
    expect(failed(evaluatePublication(state, 'production', TODAY))).toContain('OWNER_PUBLICATION');
  });

  it('文面変更・未確認項目の追加・根拠の欠落は公開判断の更新を求める', () => {
    const changed = snapshot();
    changed.approvals[0]!.currentSha256 = HASH;
    const extra = snapshot();
    extra.humanChecksPending.push('new-check');
    const noEvidence = snapshot();
    noEvidence.ownerPublication = { ...noEvidence.ownerPublication!, evidence: '' };
    for (const state of [changed, extra, noEvidence])
      expect(failed(evaluatePublication(state, 'production', TODAY))).toContain('OWNER_PUBLICATION');
  });

  it('準備中・仮の連絡先・未接続フォームは承認があっても停止する', () => {
    const draft = snapshot();
    draft.placeholder = true;
    expect(failed(evaluatePublication(draft, 'production', TODAY))).toContain('PLACEHOLDER');
    const phone = snapshot();
    phone.fields = phone.fields.map((f) => f.key === 'TEL' ? { ...f, value: '000-0000-0000' } : f);
    expect(failed(evaluatePublication(phone, 'production', TODAY))).toContain('TEL');
    const form = snapshot();
    form.contactMethod = 'form';
    expect(failed(evaluatePublication(form, 'production', TODAY))).toContain('FORM_ENDPOINT');
  });

  it('不完全・破損した専門家確認記録を警告へ下げない', () => {
    for (const record of [
      { version: 'v1', approvedOn: null, reviewerRole: null, catalogSha256: null },
      { version: 'v1', approvedOn: TODAY, reviewerRole: 'attorney', catalogSha256: HASH },
    ] satisfies C.LegalApproval[]) {
      const state = snapshot();
      state.approvals[0]!.record = record;
      expect(failed(evaluatePublication(state, 'production', TODAY))).toContain('LEGAL_APPROVALS.terms');
    }
  });
});
