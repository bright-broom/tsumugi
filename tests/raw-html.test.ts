import { describe, expect, it } from 'vitest';
import { ic } from '@/lib/ic';
import { raw, unsafeHtml } from '@/lib/raw';

describe('raw() に渡す HTML の許可リスト（ADR 0087）', () => {
  it('本文で使っている装飾・自サイトへのリンク・アイコンは通す', () => {
    for (const html of [
      '<strong>買い切り</strong>で、<em>月額 0 円</em>。<br>外部費は別途',
      '<p class="lead">説明</p><span class=\'dim\'>補足</span>',
      '<a href="/price.html">料金</a>・<a href="#faq-cost">よくある質問</a>',
      '<a href="tel:08045601124">電話</a><a href="mailto:a@example.jp">メール</a>',
      ic('check', 'ic-sm'),
    ])
      expect(unsafeHtml(html), html).toEqual([]);
  });

  it('スクリプト・イベント属性・危険なリンク先・埋め込みは止める', () => {
    const cases: [string, string][] = [
      ['<script>alert(1)</script>', 'script'],
      ['<img src=x onerror=alert(1)>', 'img'],
      ['<strong onclick="x()">太字</strong>', 'onclick'],
      ['<a href="javascript:alert(1)">x</a>', 'href not allowed'],
      ['<a href="//evil.example/">x</a>', 'href not allowed'],
      ['<a href=" JavaScript:alert(1)">x</a>', 'href not allowed'],
      ['<iframe src="https://example.com"></iframe>', 'iframe'],
      ['<span style="position:fixed">x</span>', 'style'],
      ['<svg><use href="#x"/></svg>', 'use'],
      ['本文 <script', 'unterminated'],
    ];
    for (const [html, expected] of cases) {
      const problems = unsafeHtml(html);
      expect(problems.join('\n'), html).toContain(expected);
      expect(() => raw(html), html).toThrow('ADR 0087');
    }
  });

  it('タグでない「<」（不等号など）は本文として扱う', () => {
    expect(unsafeHtml('1 &lt; 2')).toEqual([]);
    expect(unsafeHtml('3 < 5 のとき')).toEqual([]);
  });
});
