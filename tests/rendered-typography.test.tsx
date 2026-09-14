import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { spaceHtml } from '@/i18n/html-typography';
import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import { ALL_ROUTES } from '@/routing/registry';

// Keep SSR and development hydration identical: text must be spaced before rendering.
for (const route of ALL_ROUTES) {
  it(`${route.id}: renders spaced text and accessible labels without an HTML rewrite`, () => {
    const html = renderToStaticMarkup(<Page {...pageProps(route.id)} />);
    expect(spaceHtml(html, false)).toBe(html);
    // Paragraphs are continuous prose: also catch boundaries split by JSX strong/span tags.
    for (const [paragraph] of html.matchAll(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/g)) {
      expect(spaceHtml(paragraph)).toBe(paragraph);
    }
  });
}
