import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Icon from '@/components/Icon';
import { ic } from '@/lib/ic';
import { ICONS } from '@/lib/icons';

describe('Lucide の静的描画', () => {
  for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
    it(`${name}: React と文字列の経路が一致する`, () => {
      const html = renderToStaticMarkup(<Icon name={name} />);
      expect(html).toBe(ic(name));
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toContain('<script');
      expect(html).toContain('width="1em" height="1em"');
    });
  }
});
