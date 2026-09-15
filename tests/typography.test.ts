import { describe, expect, it } from 'vitest';
import { japaneseSpacing } from '@/i18n/typography';
import { spaceHtml } from '@/i18n/html-typography';
import { format } from '@/i18n/format';
import { getMessages } from '@/i18n/catalog';
import * as P from '@/content/prices';

describe('Japanese typography', () => {
  it.each([
    ['制作79,800円／月4,800円', '制作 79,800 円／月 4,800 円'],
    ['日本語ReactとNext.jsの3ページ', '日本語 React と Next.js の 3 ページ'],
    ['A日Bと1枚2色', 'A 日 B と 1 枚 2 色'],
    ['すでに 3 ページ・0.18 秒', 'すでに 3 ページ・0.18 秒'],
    ['漢字かなカナ・ひらがな', '漢字かなカナ・ひらがな'],
    [
      'URL https://example.jp/日本語3?q=1#章2 メール info@example.jp',
      'URL https://example.jp/日本語3?q=1#章2 メール info@example.jp',
    ],
    ['問い合わせinfo@example.jpへ', '問い合わせ info@example.jp へ'],
  ])('spaces text without corrupting data: %s', (source, expected) => {
    expect(japaneseSpacing(source)).toBe(expected);
    expect(japaneseSpacing(expected)).toBe(expected);
  });
  it('spaces across inline boundaries and comments without changing block boundaries', () => {
    expect(
      spaceHtml('<p>制作<strong>79,800</strong>円<span>から</span></p><p>1</p><p>枚</p>'),
    ).toBe('<p>制作<strong> 79,800</strong> 円<span>から</span></p><p>1</p><p>枚</p>');
    expect(spaceHtml('<p>日本<!-- marker --><span>React</span>で</p>')).toBe(
      '<p>日本<!-- marker --><span> React</span> で</p>',
    );
  });
  it('keeps source code, scripts, addresses, styles and form values byte-for-byte', () => {
    const html =
      '<script type="application/ld+json">{"text":"日本3"}</script><style>.日本3{color:red}</style><pre>日本3</pre><code>日本3</code><textarea>日本3</textarea><input value="日本3"><a href="/日本3?q=4" id="日本3">詳しく</a>';
    expect(spaceHtml(html)).toBe(html);
  });
  it('normalizes accessible copy and table labels while protecting machine attributes', () => {
    expect(
      spaceHtml(
        '<img src="/日本3.png" alt="事例3枚"><table><tr><th data-h="第1期">第1期</th></tr></table><meta name="description" content="日本React制作">',
      ),
    ).toBe(
      '<img src="/日本3.png" alt="事例 3 枚"><table><tr><th data-h="第 1 期">第 1 期</th></tr></table><meta name="description" content="日本 React 制作">',
    );
  });
  it('escapes decoded entities once and retains SVG geometry', () => {
    const html =
      '<svg viewBox="0 0 100 100"><path d="M0 0L10 20"/><text x="10">日本3&amp;4円</text></svg>';
    const spaced =
      '<svg viewBox="0 0 100 100"><path d="M0 0L10 20"/><text x="10">日本 3&amp;4 円</text></svg>';
    expect(spaceHtml(html)).toBe(spaced);
    expect(spaceHtml(spaced)).toBe(spaced);
  });
  it('uses one comparison label on home and pricing, preserving each calculated total', () => {
    const { home, price } = getMessages();
    expect(home.comparison).toEqual(price.comparison);
    for (const row of P.compareRows()) {
      const html = spaceHtml(
        format(home.comparison.ours, {
          price: row.our_price.toLocaleString('en-US'),
          total: row.our_total.toLocaleString('en-US'),
        }),
      );
      expect(html).not.toMatch(/＋保守|＋外部費/);
      expect(html).toContain(`制作 ${row.our_price.toLocaleString('en-US')} 円`);
      expect(html).toContain(`<strong>${row.our_total.toLocaleString('en-US')} 円</strong>`);
      expect(row.our_total).toBe(
        row.our_price + (row.our_run + row.our_external) * P.COMPARE_MONTHS,
      );
    }
  });
});
