import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonicalUrl, normalizePhone } from '../../tools/ops/shared/normalize';
import {
  type Ledger,
  exportForCrm,
  filterLeads,
  importLeads,
  purgeExpired,
  reviewLead,
  viewLedger,
} from '../../tools/ops/leads/model';

const sample = readFileSync(
  new URL('../../tools/ops/fixtures/leads-sample.csv', import.meta.url),
  'utf8',
);
const empty: Ledger = { imports: [], leads: [] };
const opts = { today: '2026-09-16', reviewCap: 100 };
const load = (
  csv = sample,
  retentionDays: number | null = 30,
  ledger = empty,
  label = 'サンプル入力元',
) => importLeads(ledger, csv, { label, collectedOn: '2026-09-10', retentionDays });
const byName = (views: ReturnType<typeof viewLedger>, name: string) =>
  views.find((v) => v.name.includes(name))!;

describe('正規化', () => {
  it('電話は全角・ハイフン・+81 をそろえ、桁数で形式を確かめる', () => {
    expect(normalizePhone('０３−００００−０００２')).toEqual({ digits: '0300000002', valid: true });
    expect(normalizePhone('+81 3 0000 0003')).toEqual({ digits: '0300000003', valid: true });
    expect(normalizePhone('123')).toEqual({ digits: '123', valid: false });
    expect(normalizePhone('  ')).toBeNull();
  });

  it('URL は www・末尾の /・クエリを除いて比べ、http(s) 以外を読まない', () => {
    const a = canonicalUrl('https://www.Example.jp/menu/?utm_source=x');
    const b = canonicalUrl('example.jp/menu');
    expect(a !== 'invalid' && b !== 'invalid' && a?.key === b?.key).toBe(true);
    expect(canonicalUrl('javascript:alert(1)')).toBe('invalid');
  });
});

describe('取り込みと重複', () => {
  it('入力元・収集日・保存期限を観測ごとに持ち、サイト状態を分類する', () => {
    const views = viewLedger(load().ledger, opts);
    expect(views).toHaveLength(3);
    expect(byName(views, '食堂').siteStatus).toBe('none');
    expect(byName(views, '工務店').siteStatus).toBe('own_site');
    expect(byName(views, '美容室').siteStatus).toBe('portal_only');
    expect(byName(views, '食堂')).toMatchObject({
      sources: ['サンプル入力元（2026-09-10）'],
      expiresOn: '2026-10-10',
    });
  });

  it('電話・URL・place_id が同じなら表記が違っても 1 件にまとめ、値が食い違えば要確認にする', () => {
    const first = load();
    const second =
      'name,phone,website\nサンプル工務店,03(0000)0002,http://example.jp\nサンプル食堂 本店,03-0000-0001,https://example.com/other\n';
    const result = load(second, 30, first.ledger, '別のサンプル入力元');
    expect(result).toMatchObject({ added: 0, updated: 2, merged: 0 });
    const views = viewLedger(result.ledger, opts);
    expect(views).toHaveLength(3);
    expect(byName(views, '工務店').reasons).not.toContain('店名が情報源で異なる');
    expect(byName(views, '食堂').reasons).toEqual(expect.arrayContaining(['店名が情報源で異なる']));
    expect(byName(views, '食堂').state).toBe('needs_review');
  });

  it('別々の見込み客をつなぐ観測が来たら統合し、要確認にする', () => {
    const first = load();
    const bridge = 'name,phone,website\nサンプル統合,03-0000-0001,https://www.example.jp/\n';
    const result = load(bridge, 30, first.ledger, '橋渡し');
    expect(result.merged).toBe(1);
    expect(result.ledger.leads).toHaveLength(2);
  });

  it('店名と地域だけが同じ候補は統合せず、要確認として示す', () => {
    const csv =
      'name,phone,area\nサンプル商店,03-0000-0011,架空市\nサンプル 商店,03-0000-0012,架空市\n';
    const views = viewLedger(load(csv).ledger, opts);
    expect(views).toHaveLength(2);
    expect(
      views.every(
        (v) => v.state === 'needs_review' && v.reasons.includes('同じ店名・地域の候補が別にある'),
      ),
    ).toBe(true);
  });

  it('同じファイルの再取り込みと、数値でない評価を拒否する', () => {
    expect(() => load(sample, 30, load().ledger)).toThrow('取り込み済み');
    expect(() => load('name,rating\nx,高い\n')).toThrow('rating');
    expect(() => load('phone\n03\n')).toThrow('name');
  });
});

describe('評価と絞り込み', () => {
  it('配点はガイドラインの 45・20・20・15。各項目に根拠を付け、未取得は 0 点で要確認', () => {
    const views = viewLedger(load().ledger, opts);
    const diner = byName(views, '食堂');
    expect(diner.scoreParts.map((p) => [p.label, p.points, p.max])).toEqual([
      ['口コミ数', 45, 45],
      ['評価', 16, 20],
      ['電話番号', 20, 20],
      ['サイト状態', 15, 15],
    ]);
    expect(diner.score).toBe(96);
    const salon = byName(views, '美容室');
    expect(salon.scoreParts[0]!.basis).toBe('未取得のため 0 点');
    expect(salon.reasons).toContain('口コミ数・評価が未取得');
    expect(
      viewLedger(load().ledger, { ...opts, reviewCap: 240 }).find((v) => v.name.includes('食堂'))!
        .scoreParts[0]!.points,
    ).toBe(23);
  });

  it('業種・地域・点数・状態・サイト状態で絞り込む', () => {
    const views = viewLedger(load().ledger, opts);
    expect(filterLeads(views, { industry: '飲食' }).map((v) => v.name)).toEqual(['サンプル食堂']);
    expect(filterLeads(views, { area: '架空町' })).toHaveLength(1);
    expect(filterLeads(views, { minScore: 90 })).toHaveLength(1);
    expect(filterLeads(views, { siteStatus: 'portal_only' })).toHaveLength(1);
    expect(filterLeads(views, { state: 'needs_review' }).map((v) => v.name)).toEqual([
      'サンプル美容室',
    ]);
  });
});

describe('CRM への出力と保存期限', () => {
  it('確認済みだけを出し、式として実行されうるセルを無害化する', () => {
    let ledger = load(
      'name,phone\n=HYPERLINK("x"),03-0000-0021\nサンプル除外,03-0000-0022\n',
      null,
    ).ledger;
    const views = viewLedger(ledger, opts);
    const a = byName(views, 'HYPERLINK');
    const b = byName(views, '除外');
    ledger = reviewLead(ledger, a.id, { state: 'reviewed', by: 'サンプル担当', on: '2026-09-16' });
    ledger = reviewLead(ledger, b.id, { state: 'excluded', by: 'サンプル担当', on: '2026-09-16' });
    const csv = exportForCrm(viewLedger(ledger, opts), { includeNeedsReview: true });
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toContain('サンプル除外');
    expect(() =>
      reviewLead(ledger, a.id, { state: 'unreviewed', by: 'x', on: '2026-09-16' }),
    ).toThrow('状態は');
  });

  it('保存期限を過ぎた情報は出力せず、purge で place_id と確認メモだけを残す', () => {
    let ledger = load().ledger;
    const diner = byName(viewLedger(ledger, opts), '食堂');
    ledger = reviewLead(ledger, diner.id, {
      state: 'reviewed',
      by: 'サンプル担当',
      on: '2026-09-16',
      note: '電話で聞いた内容（サンプル）',
    });
    const later = { ...opts, today: '2026-10-11' };
    expect(() => exportForCrm(viewLedger(ledger, later), { includeNeedsReview: false })).toThrow(
      'purge',
    );
    const { ledger: purged, purged: count } = purgeExpired(ledger, later.today);
    expect(count).toBe(3);
    const kept = purged.leads.find((l) => l.id === diner.id)!;
    expect(kept.observations[0]).toEqual({
      source: expect.any(Object),
      purged: true,
      placeId: 'sample-place-001',
    });
    expect(kept.review.note).toBe('電話で聞いた内容（サンプル）');
    expect(JSON.stringify(purged)).not.toContain('03-0000-0001');
    // 破棄済みの見込み客は CRM に渡さない（期限内に確認した先だけを移す）。
    const after = exportForCrm(viewLedger(purged, later), { includeNeedsReview: true });
    expect(after.trim().split('\r\n')).toHaveLength(1);
    expect(after).toContain('place_id');
  });
});
