import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getMessages } from '@/i18n/catalog';
import { format } from '@/i18n/format';
import { ALL_ROUTES, PUBLIC_ROUTES, STATIC_ROUTES, getRoute, href } from '@/routing/registry';
import { OG_CARDS } from '@/content/og';
import { NAV, NAV_LEGAL, INDUSTRIES } from '@/content/nav';
import { IND_DATA } from '@/content/industries';
import { TEL, TEL_LINK } from '@/content/config';
import { heroSvg } from '@/content/hero';
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
      'diagrams',
      'entry',
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
  it('uses the confirmed business number for display and dialing (Issue #12)', () => {
    expect(TEL).toBe('080-4560-1124');
    expect(TEL_LINK).toBe('08045601124');
  });
  it.each(ALL_ROUTES)('leaves no placeholder or foreign tel: link on $file', (route) => {
    const html = renderToStaticMarkup(<Page {...pageProps(route.id)} />);
    const links = [...html.matchAll(/href="tel:([^"]*)"/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    expect(new Set(links)).toEqual(new Set(['08045601124']));
    expect(html).toContain('080-4560-1124');
    expect(html).not.toMatch(/000-0000-0000|00000000000/);
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
    for (const text of Object.values(replacement)) expect(html.split(text)).toHaveLength(2);
    expect(html).toContain('<h1 id="brand-heading">A new heading<br/>A second line</h1>');
    expect(html).toContain('alt="Artwork description"');
    expect(html).not.toContain(getMessages().home.hero.heading);
    // 背景画のファイルも同じカタログの代替説明だけを持つ（Issue #36：コピーの変更だけで全表示が同期する）
    expect(heroSvg(replacement.artworkAlt, '')).toContain('<title id="title">Artwork description</title>');
  });

  it('exposes each hero string once, so assistive technology reads it once (Issue #36)', () => {
    const hero = getMessages().home.hero;
    const html = renderToStaticMarkup(<Page {...pageProps('index')} />);
    const start = html.indexOf('<section class="brand-hero"');
    const section = html.slice(start, html.indexOf('</section>', start));
    for (const text of [hero.heading, hero.heading2, hero.message, hero.message2, hero.artworkAlt])
      expect(html.split(text)).toHaveLength(2);
    expect(section).toContain('aria-labelledby="brand-heading"');
    expect(section).toContain(`alt="${hero.artworkAlt}"`);
    expect(section.match(/<h1/g)).toHaveLength(1);
    expect(section).not.toMatch(/aria-hidden|aria-label=|role="presentation"|<svg/);
    for (const text of [hero.heading, hero.heading2, hero.message, hero.message2])
      expect(hero.artworkAlt).not.toContain(text);
  });
});

describe('hero artwork', () => {
  it('wraps only the approved text-free raster and describes the art, not the copy (Issue #36)', () => {
    const hero = getMessages().home.hero;
    const svg = heroSvg(hero.artworkAlt, 'AAAA');
    expect(svg).not.toMatch(/<text|<tspan|<foreignObject|font-family/);
    expect(svg.match(/<title/g)).toHaveLength(1);
    expect(svg).toContain(`<title id="title">${hero.artworkAlt}</title>`);
    for (const text of [hero.heading, hero.heading2, hero.message, hero.message2])
      expect(svg).not.toContain(text);
    // 絵を差し替えるときは、文字が描き込まれていないことを画面で確かめてから値を更新する（src/assets/hero/README.md）
    const webp = readFileSync(new URL('../src/assets/hero/onokoro.webp', import.meta.url));
    expect(createHash('sha256').update(webp).digest('hex')).toBe(
      '8a74eca63b3425acc9cffa0f4673e5c69cdc9e4371d5df0753f14b32869c2ebd',
    );
  });
});

describe('adopted tariff presentation', () => {
  it('shows the CMS plan as preparing and separates external costs from support', () => {
    const html = renderToStaticMarkup(<Page {...pageProps('price')} />);
    expect(html).toContain('受付準備中');
    expect(html).toContain('外部');
    expect(html).toContain('30 分');
    expect(html).toContain('90 分');
    expect(html).toContain('676,800');
    expect(html).toContain('139,000');
    expect(html).not.toContain('type="radio"');
  });
});
