import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import { getMessages } from '@/i18n/catalog';
import {
  catalogCostExamples,
  proposedFeaturePayment,
  productionPlans,
  RUN,
  OPTIONS,
  PROPOSED_PRICES,
} from '@/content/prices';

type Node = DefaultTreeAdapterMap['node'];
function elements(node: Node): DefaultTreeAdapterMap['element'][] {
  return [
    ...('tagName' in node ? [node] : []),
    ...('childNodes' in node ? node.childNodes.flatMap(elements) : []),
  ];
}

describe('complete plan catalog', () => {
  it('keeps proposed prices outside the existing saleable plan inventories', () => {
    expect(productionPlans().map((p) => p.price)).toEqual([100000, 250000, 450000]);
    expect(RUN.map((p) => p.price)).toEqual([0, 6000, 12000, 30000]);
    expect(OPTIONS).toHaveLength(8);
    expect(Object.values(PROPOSED_PRICES).every((p) => p.status === 'concept')).toBe(true);
  });
  it('counts discovery once inside the feature-development total', () => {
    const payment = proposedFeaturePayment();
    expect(payment).toEqual({ design: 60000, start: 390000, acceptance: 450000, total: 900000 });
    expect(payment.design + payment.start + payment.acceptance).toBe(payment.total);
  });
  it('matches all six reviewed cost scenarios including external costs and no support', () => {
    expect(catalogCostExamples().map((sample) => [sample.year, sample.threeYears])).toEqual([
      [142000, 226000],
      [292000, 376000],
      [492000, 576000],
      [550800, 752400],
      [1020000, 1260000],
      [1380000, 2340000],
    ]);
  });
  it('labels unready products locally and does not attach purchase actions to them', () => {
    const html = renderToStaticMarkup(<Page {...pageProps('plans')} />);
    const nodes = elements(parse(html));
    const concepts = nodes.filter((node) =>
      node.attrs.some((a) => a.name === 'data-status' && a.value === 'concept'),
    );
    const preparing = nodes.filter((node) =>
      node.attrs.some((a) => a.name === 'data-status' && a.value === 'preparing'),
    );
    expect(concepts).toHaveLength(4);
    expect(preparing).toHaveLength(2);
    for (const node of [...concepts, ...preparing]) {
      expect(
        elements(node).filter((child) => ['a', 'button', 'form'].includes(child.tagName)),
      ).toHaveLength(0);
    }
    for (const plan of [...productionPlans(), ...RUN, ...OPTIONS])
      expect(html).toContain(plan.name);
    for (const [anchor] of getMessages().shell.pageIndex.pages.catalog)
      expect(html).toContain(`id="${anchor}"`);
    expect(html).not.toMatch(/hourlyCost|economic_surplus|機会費用|受注率|粗利率/);
  });
});

it('多言語の提供状態を料金表とプラン比較の両方に表示する', () => {
  for (const page of ['price', 'plans'] as const) {
    const html = renderToStaticMarkup(<Page {...pageProps(page)} />);
    expect(html).toContain('対応言語・翻訳範囲・表示品質');
    expect(html).toContain('150,000');
    expect(html).toContain('受付準備中');
  }
});
