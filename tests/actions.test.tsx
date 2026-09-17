import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActionButton, ActionLink } from '@/components/Action';
import PhoneLink from '@/components/PhoneLink';
import { TEL_LINK } from '@/content/config';

describe('shared action semantics', () => {
  it('keeps navigation a native link, including anchors and accessible names', () => {
    const html = renderToStaticMarkup(
      <ActionLink
        variant="secondary"
        href="#plans"
        aria-label="Compare plans"
        className="catalog-plan-cta"
      >
        Plans
      </ActionLink>,
    );
    expect(html).toContain('class="btn btn-2 catalog-plan-cta"');
    expect(html).toContain('href="#plans"');
    expect(html).toContain('aria-label="Compare plans"');
    expect(html).not.toContain('<button');
  });
  it('does not submit a surrounding form unless explicitly requested', () => {
    expect(renderToStaticMarkup(<ActionButton>Open</ActionButton>)).toContain('type="button"');
    const submit = renderToStaticMarkup(
      <ActionButton type="submit" disabled aria-describedby="reason">
        Send
      </ActionButton>,
    );
    expect(submit).toContain('type="submit"');
    expect(submit).toContain('disabled=""');
    expect(submit).toContain('aria-describedby="reason"');
  });
  it('preserves the canonical dial target for inline and button presentations', () => {
    for (const variant of [undefined, 'primary', 'secondary'] as const) {
      const html = renderToStaticMarkup(<PhoneLink variant={variant} />);
      expect(html).toContain(`href="tel:${TEL_LINK}"`);
      expect(html).toContain('class="num"');
      expect(html).toContain('aria-hidden="true"');
      expect(html.includes('btn-')).toBe(variant !== undefined);
    }
  });
});
