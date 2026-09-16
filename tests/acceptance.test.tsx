import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import type { AcceptanceRecord } from '@/content/acceptance';
import { SPEC_ITEMS } from '@/content/spec';
import { getMessages } from '@/i18n/catalog';
import {
  ACCEPTANCE,
  acceptanceEntries,
  auditAcceptance,
  methodOf,
  pendingHumanChecks,
} from '../tools/verify/acceptance';
import type { Result } from '../tools/verify/results';
import { imageFindings } from '../tools/verify/static';

const TODAY = '2026-09-16';
const row = (check: string, level: Result['level'] = 'PASS'): Result => ({ level, check, page: 'index.html', detail: '' });
/** 対応表が参照するすべての検査名が、PASS で 1 件ずつ記録された実行 */
const allChecks = (ranBrowser: boolean) =>
  [...new Set(Object.values(ACCEPTANCE).flatMap((r) => [...r.static, ...(ranBrowser ? r.browser : [])]))].map((c) => row(c));

describe('納品仕様 20 項目と受入検査の対応表', () => {
  it('20 項目すべてを覆い、ページに出す確認の方法と一致する', () => {
    expect(SPEC_ITEMS).toHaveLength(20);
    expect(Object.keys(ACCEPTANCE).sort()).toEqual(SPEC_ITEMS.map((it) => it.id).sort());
    for (const it of SPEC_ITEMS) expect([it.id, methodOf(ACCEPTANCE[it.id])]).toEqual([it.id, it.check]);
  });

  it('外部接続（GBP・通知 2 系統・口コミの運用）は自動検査済みにしない', () => {
    for (const id of ['business-profile', 'notifications', 'reviews'] as const) {
      expect(ACCEPTANCE[id].external.length).toBeGreaterThan(0);
      expect(SPEC_ITEMS.find((it) => it.id === id)!.check).toBe('external');
    }
  });

  it('検査名がそろっていれば PASS 1 件、静的検査だけの実行ではブラウザの検査名を求めない', () => {
    expect(auditAcceptance(allChecks(true), true).map((r) => r.level)).toEqual(['PASS']);
    expect(auditAcceptance(allChecks(false), false).map((r) => r.level)).toEqual(['PASS']);
  });

  it('対応漏れ・存在しない検査名・ページの表示との食い違いを FAIL で止める', () => {
    const rest = Object.fromEntries(Object.entries(ACCEPTANCE).filter(([id]) => id !== 'phone'));
    expect(auditAcceptance(allChecks(true), true, { rules: rest }).map((r) => [r.level, r.page])).toEqual([
      ['FAIL', 'phone'],
    ]);

    const typo = { ...ACCEPTANCE, hours: { ...ACCEPTANCE.hours, static: ['02-03 営業時間'] } };
    expect(auditAcceptance(allChecks(true), true, { rules: typo }).map((r) => r.page)).toEqual(['hours']);

    const claimsAuto = SPEC_ITEMS.map((it) => (it.id === 'area' ? { ...it, check: 'auto' as const } : it));
    expect(auditAcceptance(allChecks(true), true, { items: claimsAuto }).map((r) => r.page)).toEqual(['area']);

    const empty = { ...ACCEPTANCE, guides: { static: [], browser: [], manual: [], external: [], outOfScope: null } };
    expect(auditAcceptance(allChecks(true), true, { rules: empty }).map((r) => r.page)).toEqual(['guides']);

    expect(auditAcceptance([], true).every((r) => r.level === 'FAIL')).toBe(true);
  });
});

describe('人の確認と外部接続の記録', () => {
  const needsRecord = SPEC_ITEMS.filter((it) => it.check !== 'auto').map((it) => it.id);

  it('記録が無い間は、人の確認が必要な項目をすべて未確認として返す', () => {
    expect(pendingHumanChecks(TODAY, { records: {} })).toEqual(needsRecord);
    expect(needsRecord).not.toContain('lcp');
  });

  it('有効な記録だけを受け付ける', () => {
    const ok: AcceptanceRecord = { checkedOn: '2026-09-10', checkedBy: 'owner', outcome: 'confirmed', evidence: 'docs/acceptance/notifications.md' };
    const pending = (records: Record<string, AcceptanceRecord>) => pendingHumanChecks(TODAY, { records });
    expect(pending({ notifications: ok })).not.toContain('notifications');
    expect(pending({ notifications: { ...ok, checkedOn: '2026-12-01' } })).toContain('notifications');
    expect(pending({ notifications: { ...ok, evidence: ' ' } })).toContain('notifications');
    // 対象外の条件が無い項目（通知 2 系統）は対象外にできない
    expect(pending({ notifications: { ...ok, outcome: 'not-applicable' } })).toContain('notifications');
    expect(pending({ 'business-profile': { ...ok, outcome: 'not-applicable' } })).not.toContain('business-profile');
  });

  it('レポートには、自動検査の結果と人の確認の状況を項目ごとに残す', () => {
    const results = [...allChecks(false).filter((r) => r.check !== '07 imgのalt'), row('07 imgのalt', 'N/A')];
    const entries = Object.fromEntries(acceptanceEntries(results, false, TODAY, { records: {} }).map((e) => [e.id, e]));
    expect(entries.photos!.automated.status).toBe('no-target');
    expect(entries.lcp!.automated.status).toBe('not-run');
    expect(entries.lcp!.human).toEqual({ required: false, status: 'none', checkedOn: null });
    expect(entries.notifications!.automated.status).toBe('none');
    expect(entries.notifications!.human.status).toBe('pending');
    const failing = acceptanceEntries([...results, row('01 電話番号(tel:＋文字)', 'FAIL')], false, TODAY);
    expect(failing.find((e) => e.id === 'phone')!.automated.status).toBe('fail');
  });
});

describe('証明にならない検査を PASS に数えない', () => {
  it('画像が 0 枚のページは alt と lazy の検査を「対象なし」にする', () => {
    const rows = imageFindings('faq.html', '<main><p>本文</p></main>');
    expect(rows.map((r) => [r.check, r.level])).toEqual([
      ['07 imgのalt', 'N/A'],
      ['14 先頭画像にlazyを付けない', 'N/A'],
    ]);
  });
  it('画像があれば従来どおり検査し、alt の無い画像（data-alt だけのものを含む）を FAIL にする', () => {
    const good = imageFindings('index.html', '<img src="a.svg" alt="" fetchPriority="high">');
    expect(good.map((r) => r.level)).toEqual(['PASS', 'PASS', 'PASS']);
    const bad = imageFindings('index.html', '<img src="a.svg" data-alt="x" loading="lazy">');
    expect(bad.map((r) => r.level)).toEqual(['FAIL', 'FAIL', 'WARN']);
  });
});

describe('仕様のページは、検査していない項目を自動検査済みと書かない', () => {
  const copy = getMessages().spec;
  const html = renderToStaticMarkup(<Page {...pageProps('spec')} />);

  it('項目ごとに、対応表どおりの確認の方法を表示する', () => {
    for (const method of ['auto', 'auto+manual', 'manual', 'external'] as const) {
      const label = copy.checkMethod[method];
      expect(html.split(`>${label}</p>`).length - 1).toBe(SPEC_ITEMS.filter((it) => it.check === method).length);
    }
  });
  it('「20項目すべてを自動でチェック」とは書かない', () => {
    expect(html).not.toMatch(/20\s*項目すべてを自動/);
  });
});
