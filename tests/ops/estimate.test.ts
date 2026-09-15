import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUILD, EXTERNAL_MONTHLY_ESTIMATE, OPTIONS, oursTotal, run } from '@/content/prices';
import { renderHtml, renderMarkdown } from '../../tools/ops/shared/document';
import { estimateDocument } from '../../tools/ops/estimate/document';
import {
  type EstimateInput,
  type PriceCatalog,
  appendVersion,
  calculateEstimate,
  diffVersions,
  estimateInputSchema,
  siteCatalog,
} from '../../tools/ops/estimate/model';

const fixture = estimateInputSchema.parse(
  JSON.parse(
    readFileSync(new URL('../../tools/ops/fixtures/estimate-basic.json', import.meta.url), 'utf8'),
  ),
);
const input = (overrides: Partial<EstimateInput> = {}): EstimateInput => ({
  ...fixture,
  options: [],
  assumptions: [],
  unconfirmed: [],
  ...overrides,
});
const saveOpts = { savedAt: '2026-09-16T01:00:00.000Z', today: '2026-09-16' };

describe('見積もりの計算は公開料金と同じ値を使う', () => {
  it('制作・継続支援・外部費の期間総額がサイトの総額計算と一致する', () => {
    const r = calculateEstimate(input({ production: 'basic', support: 'run_light', months: 36 }));
    const basic = BUILD.find((p) => p.key === 'basic')!;
    expect(r.periodSubtotal).toBe(oursTotal(basic.price, 'run_light', 36));
    expect(r.monthlySubtotal).toBe(run('run_light').price);
    expect(r.externalSubtotal).toBe(EXTERNAL_MONTHLY_ESTIMATE);
    expect(r.initialSubtotal).toBe(basic.price);
  });

  it('オプションはキーで引き、数量を掛ける。別見積もりは目安として未確定に残す', () => {
    const r = calculateEstimate(
      input({
        options: [
          { key: 'page_add', quantity: 2 },
          { key: 'photo_half_day', quantity: 1 },
        ],
      }),
    );
    const page = OPTIONS.find((o) => o.key === 'page_add')!;
    const photo = OPTIONS.find((o) => o.key === 'photo_half_day')!;
    expect(r.optionsSubtotal).toBe(page.price * 2 + photo.price);
    expect(r.lines.find((l) => l.id === 'option:photo_half_day')?.certainty).toBe('reference');
    expect(r.provisional).toBe(true);
    expect(r.notes.some((n) => n.includes(photo.name))).toBe(true);
    expect(r.notes).toContain('オプションの請求時期は、ご契約時に確定します');
  });

  it('外部費は常に仮置きで、確定した見積もりとして扱わない', () => {
    const r = calculateEstimate(input());
    expect(r.lines.find((l) => l.id === 'external')?.certainty).toBe('provisional');
    expect(r.provisional).toBe(true);
  });

  it('受付準備中のプランは発行を止める', () => {
    const r = calculateEstimate(input({ production: 'standard' }));
    expect(r.blockers).toHaveLength(1);
    expect(() => appendVersion(null, input({ production: 'standard' }), saveOpts)).toThrow(
      '受付準備中',
    );
  });

  it('知らないキー・重複・分割払い・逆転した期限を拒否する', () => {
    expect(() => calculateEstimate(input({ support: 'run_premium' }))).toThrow('継続支援');
    expect(() =>
      calculateEstimate(
        input({
          options: [
            { key: 'logo', quantity: 1 },
            { key: 'logo', quantity: 1 },
          ],
        }),
      ),
    ).toThrow('重複');
    expect(estimateInputSchema.safeParse({ ...fixture, payment: 'installment_24' }).success).toBe(
      false,
    );
    expect(estimateInputSchema.safeParse({ ...fixture, validUntil: '2026-09-01' }).success).toBe(
      false,
    );
    expect(estimateInputSchema.safeParse({ ...fixture, price: 1 }).success).toBe(false);
  });
});

describe('端数', () => {
  const odd: PriceCatalog = {
    ...siteCatalog(),
    production: [{ key: 'odd', name: '架空の制作', price: 12345, preparing: false }],
    support: [{ key: 'odd_run', name: '架空の支援', price: 1005 }],
  };

  it('着手金は切り捨て、残りを検収時に回し、合計は変わらない', () => {
    const r = calculateEstimate(input({ production: 'odd', support: 'odd_run' }), odd);
    const [deposit, acceptance] = r.invoices;
    expect(deposit!.subtotal).toBe(6172);
    expect(acceptance!.subtotal).toBe(6173);
    expect(deposit!.subtotal + acceptance!.subtotal).toBe(12345);
  });

  it('消費税は請求ごとに四捨五入し、合計に一度掛けた額との 1 円差をそのまま出す', () => {
    const r = calculateEstimate(input({ production: 'odd', support: 'odd_run', months: 2 }), odd);
    expect(r.invoices[0]!.total).toBe(6789); // 6789.2
    expect(r.invoices[1]!.total).toBe(6790); // 6790.3
    expect(r.initialTotal).toBe(13579);
    expect(Math.round(12345 * 1.1)).toBe(13580);
    expect(r.monthlyTotal).toBe(1106); // 1105.5 → 1106
    expect(r.periodTotal).toBe(13579 + (1106 + Math.round(EXTERNAL_MONTHLY_ESTIMATE * 1.1)) * 2);
  });
});

describe('版と差額', () => {
  it('版を重ね、同じ内容や期限切れは保存しない', () => {
    const v1 = appendVersion(null, input(), saveOpts);
    expect(v1.versions.map((v) => v.version)).toEqual([1]);
    expect(() => appendVersion(v1, input(), saveOpts)).toThrow('同じ内容');
    expect(() =>
      appendVersion(v1, input({ months: 24 }), { ...saveOpts, today: '2026-11-01' }),
    ).toThrow('有効期限');
    const v2 = appendVersion(
      v1,
      input({ months: 24, options: [{ key: 'logo', quantity: 1 }] }),
      saveOpts,
    );
    expect(v2.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(() => appendVersion(v2, input({ estimateId: 'est-other' }), saveOpts)).toThrow(
      '見積番号',
    );
  });

  it('変更前後の差額を明細と合計で出す', () => {
    const v1 = appendVersion(null, input({ months: 36 }), saveOpts);
    const v2 = appendVersion(
      v1,
      input({ months: 24, options: [{ key: 'logo', quantity: 1 }] }),
      saveOpts,
    );
    const diff = diffVersions(v2.versions[0]!, v2.versions[1]!);
    const logo = OPTIONS.find((o) => o.key === 'logo')!.price;
    const monthly = run('run_basic').price + EXTERNAL_MONTHLY_ESTIMATE;
    expect(diff.lines).toEqual([
      { label: expect.any(String), change: 'added', before: 0, after: logo },
    ]);
    expect(diff.totals.find((t) => t.label === '初期費用（税別）')?.delta).toBe(logo);
    expect(diff.totals.find((t) => t.label === '期間の総額（税別）')?.delta).toBe(
      logo - monthly * 12,
    );
    expect(diff.fields).toContainEqual({ label: '期間（か月）', before: '36', after: '24' });
  });
});

describe('顧客向け書面', () => {
  const file = appendVersion(
    null,
    input({ ...fixture, customerLabel: '<img src=x onerror=alert(1)>商店' }),
    saveOpts,
  );
  const version = file.versions[0]!;

  it('印刷用 HTML は script・イベント属性を含まず、宛名をエスケープする', () => {
    const html = renderHtml(estimateDocument(version, { today: '2026-09-16' }));
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<[^>]*\son[a-z]+=/i);
    expect(html).not.toMatch(/<link|@import|url\(/i);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;商店');
  });

  it('Markdown に版・有効期限・前提・未確定・期限切れの注意を出す', () => {
    const md = renderMarkdown(estimateDocument(version, { today: '2026-10-17' }));
    expect(md).toContain('お見積書（第1版）');
    expect(md).toContain('| 有効期限 | 2026-10-16 |');
    expect(md).toContain('有効期限（2026-10-16）を過ぎています');
    expect(md).toContain('写真は支給素材を使う（サンプルの前提）');
    expect(md).toContain('公開日（サンプルの未確定事項）');
    expect(md).toContain('目安（別見積もり）');
  });
});
