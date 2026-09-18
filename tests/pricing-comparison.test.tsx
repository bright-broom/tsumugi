import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import * as prices from '@/content/prices';

afterEach(() => vi.restoreAllMocks());

describe('home pricing comparison', () => {
  it('shows the production fee as the primary price and external costs as a separate period total', () => {
    const html = renderToStaticMarkup(<Page {...pageProps('index')} />);
    const comparison = html
      .split('class="comparison-totals"')[1]
      ?.split('class="comparison-difference"')[0];
    expect(comparison).toMatch(
      /紬・1 ページの制作費（買い切り）<\/h3><strong class="tnum">100,000 円<\/strong>/,
    );
    expect(html).toContain('226,000 円');
    expect(html).toContain('紬のほうが 131,800 円安い試算です。');
    expect(html).toContain('紬への月額 0 円');
    expect(html).toContain('3,500');
    expect(html).toContain('保守契約なし');
    expect(html).not.toMatch(/378,600|346,200|(?<!\d)4,800|-131,800 円高い/);
  });
  it.each([
    [1000, '紬のほうが 1,000 円高い試算です。'],
    [0, '試算上の総額は同額です。'],
    [-1000, '紬のほうが 1,000 円安い試算です。'],
  ] as const)('describes the actual sign of the difference (%s)', (diff, text) => {
    const rows = prices.compareRows();
    vi.spyOn(prices, 'compareRows').mockReturnValue([
      { ...rows[0]!, diff, our_total: rows[0]!.sub_total + diff },
      ...rows.slice(1),
    ]);
    expect(renderToStaticMarkup(<Page {...pageProps('index')} />)).toContain(text);
  });
});

it('keeps maintenance optional on the price page, with the paid care tariff available', () => {
  const html = renderToStaticMarkup(<Page {...pageProps('price')} />);
  expect(html).toContain('制作費は買い切り。保守契約は不要です');
  expect(html).toContain('管理を任せたい方だけ、追加の支援プラン');
  expect(html).toContain('6,000');
  expect(html).toContain('紬への月額 0 円');
  expect(html).toContain('226,000 円');
});
