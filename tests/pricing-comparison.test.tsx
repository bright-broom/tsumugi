import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import * as prices from '@/content/prices';

afterEach(() => vi.restoreAllMocks());

describe('home pricing comparison', () => {
  it('shows the reduced total including Vercel external costs and retained service conditions', () => {
    const html = renderToStaticMarkup(<Page {...pageProps('index')} />);
    expect(html).toContain('346,200 円');
    expect(html).toContain('紬のほうが 11,600 円安い試算です。');
    expect(html).toContain('3,900');
    expect(html).toContain('3,500');
    expect(html).toContain('保守のみ');
    expect(html).not.toMatch(/378,600|20,800|(?<!\d)4,800|-11,600 円高い/);
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
