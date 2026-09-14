import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getMessages } from '@/i18n/catalog';
import { format } from '@/i18n/format';
import { ALL_ROUTES, PUBLIC_ROUTES, STATIC_ROUTES, getRoute, href } from '@/routing/registry';
import { OG_CARDS } from '@/content/og';
import { NAV, NAV_LEGAL, INDUSTRIES } from '@/content/nav';
import { IND_DATA } from '@/content/industries';
import { TEL, TEL_LINK } from '@/content/config';
import { ContentProvider } from '@/components/ContentProvider';
import PhoneLink from '@/components/PhoneLink';
import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import { inspectSource } from '../tools/verify/source-policy';

describe('catalog interpolation', () => {
  it('reorders named values and preserves zero and repeated parameters', () => {
    expect(format('{unit} {amount} / {amount}', { amount: 0, unit: 'JPY' })).toBe('JPY 0 / 0');
  });
  it('does not evaluate or recursively interpolate inserted values', () => {
    expect(format('{value}', { value: '{other}<script>' })).toBe('{other}<script>');
  });
  it('fails on missing own parameters and unsupported locales', () => {
    expect(() => format('{value}', Object.create({ value: 'inherited' }))).toThrow('Missing');
    expect(() => getMessages('en')).toThrow('Unsupported');
  });
  it('resolves every symbolic link before rendering', () => {
    expect(JSON.stringify(getMessages())).not.toMatch(/@route:|@brand:/);
  });
});

describe('route completeness', () => {
  it('uses one inventory for static pages, navigation, industry content and OG cards', () => {
    expect(ALL_ROUTES).toHaveLength(21);
    expect(STATIC_ROUTES).toHaveLength(19);
    expect(new Set(ALL_ROUTES.map((r) => r.file)).size).toBe(21);
    expect(Object.keys(OG_CARDS).sort()).toEqual(ALL_ROUTES.map((r) => r.file).sort());
    expect([...NAV, ...NAV_LEGAL, ...INDUSTRIES].map(([f]) => f).sort()).toEqual(
      PUBLIC_ROUTES.map((r) => r.file).sort(),
    );
    expect(Object.keys(IND_DATA).sort()).toEqual(INDUSTRIES.map(([f]) => f).sort());
  });
  it('rejects unknown or prototype route names', () => {
    for (const id of ['unknown', 'toString', '__proto__', '../price', 'price.html'])
      expect(getRoute(id)).toBeUndefined();
    expect(href('price', 'plans')).toBe('/price.html#plans');
  });
  it.each(ALL_ROUTES)('renders $file from serializable props without runtime scripts', (route) => {
    const props = JSON.parse(JSON.stringify(pageProps(route.id)));
    expect(props.copy).toEqual(getMessages()[route.template]);
    expect(Object.keys(props.messages).sort()).toEqual([
      'cta',
      'entry',
      'figure',
      'plans',
      'shell',
      'table',
      'vs',
    ]);
    expect(Buffer.byteLength(JSON.stringify(props), 'utf8')).toBeLessThan(64 * 1024);
    const html = renderToStaticMarkup(<Page {...props} />);
    expect(html).toContain('<main id="main">');
    expect(html).not.toMatch(/<script(?![^>]*application\/ld\+json)/);
    expect(html).not.toMatch(/@route:|電話する|タップで発信|undefined/);
    expect(html).not.toMatch(/39,800|698,000|変更は何回でも無料|修正・更新 何回でも|制作費24回/);
  });
});

describe('telephone presentation', () => {
  it('contains an ignored decorative icon and exactly the displayed number', () => {
    const html = renderToStaticMarkup(
      <ContentProvider messages={getMessages()}>
        <PhoneLink />
      </ContentProvider>,
    );
    expect(html).toContain(`href="tel:${TEL_LINK}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html.replace(/<[^>]*>/g, '')).toBe(TEL);
  });
});

describe('copy regression guard', () => {
  it('detects Japanese and English JSX, attributes, templates and direct URLs', () => {
    for (const source of [
      '<p>こんにちは</p>',
      '<p>Hello</p>',
      '<input placeholder="Name" />',
      '<input placeholder={"Name"} />',
      '<p>{"Hello"}</p>',
      '<p>{ready ? "Ready" : "Waiting"}</p>',
      '<p>{ready && "Ready"}</p>',
      '<p>{`Hello ${name}`}</p>',
      'const item = { label: "Email" };',
      'const x = `約${days}日`;',
      '<a href="price.html" />',
    ]) {
      expect(inspectSource('src/views/example.tsx', source).length).toBeGreaterThan(0);
    }
  });
  it('allows catalog references, comments and nonlinguistic identifiers', () => {
    expect(
      inspectSource(
        'src/views/example.tsx',
        '// 日本語のコメント\nconst x = <p className={"lead"} id="intro">{copy.lead}{"—"}{status === "ready" && copy.ready}{href("price")}</p>; const y = { id: "name", value: "email" }; throw new Error("Invalid configuration");',
      ),
    ).toEqual([]);
  });
});

describe('hero catalog', () => {
  it('renders replacement copy as HTML independently of the artwork', () => {
    const props = JSON.parse(JSON.stringify(pageProps('index')));
    const replacement = {
      heading: 'A new heading',
      heading2: 'A second line',
      message: 'A new message',
      message2: 'Another message',
      artworkAlt: 'Artwork description',
    };
    props.copy.hero = replacement;
    const html = renderToStaticMarkup(<Page {...props} />);
    for (const text of Object.values(replacement)) expect(html).toContain(text);
    expect(html).toContain('<h1 id="brand-heading">A new heading<br/>A second line</h1>');
    expect(html).not.toContain(getMessages().home.hero.heading);
  });
});

describe('adopted tariff presentation', () => {
  it('shows the CMS plan as preparing and separates external costs from support', () => {
    const html = renderToStaticMarkup(<Page {...pageProps('price')} />);
    expect(html).toContain('受付準備中');
    expect(html).toContain('外部');
    expect(html).toContain('30分');
    expect(html).toContain('90分');
    expect(html).toContain('676,800');
    expect(html).toContain('139,000');
    expect(html).not.toContain('type="radio"');
  });
});
