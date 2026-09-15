import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { describe, expect, it } from 'vitest';
import { ContentProvider } from '@/components/ContentProvider';
import Figure from '@/components/Figure';
import { LandVsOwn } from '@/components/diagrams/LandVsOwn';
import { MoneyFlow } from '@/components/diagrams/MoneyFlow';
import { OwnershipClock } from '@/components/diagrams/OwnershipClock';
import { RentVsOwn } from '@/components/diagrams/RentVsOwn';
import { SubsidyBar } from '@/components/diagrams/SubsidyBar';
import { SubsidyTimeline } from '@/components/diagrams/SubsidyTimeline';
import { getMessages } from '@/i18n/catalog';
import type { SharedMessages } from '@/content/page-props';

type Element = DefaultTreeAdapterMap['element'];
type Node = DefaultTreeAdapterMap['node'];

function elements(node: Node, tag: string): Element[] {
  return [
    ...('tagName' in node && node.tagName === tag ? [node] : []),
    ...('childNodes' in node ? node.childNodes.flatMap((child) => elements(child, tag)) : []),
  ];
}

const attr = (node: Element, name: string) => node.attrs.find((a) => a.name === name)?.value;
const render = (children: ReactNode, messages: SharedMessages = getMessages()) =>
  renderToStaticMarkup(<ContentProvider messages={messages}>{children}</ContentProvider>);

const diagrams = [
  ['land', () => <LandVsOwn />],
  ['money', () => <MoneyFlow portal={27_500} run={16_000} />],
  ['clock', () => <OwnershipClock subMonthly={9_800} subTotal={357_800} ourPrice={79_800} />],
  ['rent', () => <RentVsOwn portal={27_500} fee={220} run={16_000} />],
  [
    'grant',
    () => <SubsidyBar total={1_000_000} web={300_000} pr={700_000} grant={500_000} net={500_000} />,
  ],
  ['timeline', () => <SubsidyTimeline form4="2026 年 12 月 4 日" deadline="2026 年 12 月 15 日" />],
] satisfies [string, () => ReactNode][];

describe('React diagrams', () => {
  it.each(diagrams)(
    '%s keeps both responsive SVG layouts, caption and accessible labels',
    (_, diagram) => {
      const html = render(diagram());
      const document = parseFragment(html);
      const svgs = elements(document, 'svg');
      expect(elements(document, 'figure')).toHaveLength(1);
      expect(elements(document, 'figcaption')).toHaveLength(1);
      expect(svgs.map((svg) => attr(svg, 'class'))).toEqual(['fw', 'fn']);
      for (const svg of svgs) {
        expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(attr(svg, 'role')).toBe('img');
        expect(attr(svg, 'aria-label')).toBeTruthy();
        expect(elements(svg, 'text').length).toBeGreaterThan(0);
        const ids = elements(svg, 'marker').map((marker) => attr(marker, 'id'));
        const used = elements(svg, 'line').flatMap((line) => {
          const reference = attr(line, 'marker-end');
          return reference ? [reference.slice(5, -1)] : [];
        });
        expect([...new Set(used)].sort()).toEqual(ids.sort());
      }
      expect(attr(svgs[0]!, 'aria-label')).toBe(attr(svgs[1]!, 'aria-label'));
      expect(html).not.toMatch(/<script|dangerouslySetInnerHTML|<!-- -->|undefined|NaN/);
    },
  );

  it('gives repeated diagrams unique markers with references scoped to their own canvas', () => {
    const content = (
      <>
        <LandVsOwn />
        <LandVsOwn />
        <RentVsOwn portal={27_500} fee={220} run={16_000} />
      </>
    );
    const html = render(content);
    const document = parseFragment(html);
    const allIds = elements(document, 'marker').map((marker) => attr(marker, 'id'));
    expect(allIds).toHaveLength(8);
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const svg of elements(document, 'svg')) {
      const ids = elements(svg, 'marker').map((marker) => attr(marker, 'id'));
      const references = elements(svg, 'line').flatMap((line) => attr(line, 'marker-end') ?? []);
      expect(references.length).toBeGreaterThan(0);
      for (const reference of references) expect(ids).toContain(reference.slice(5, -1));
    }
    // An unrelated render must not advance a global counter or affect the output.
    render(<MoneyFlow portal={10_000} run={5_000} />);
    expect(render(content)).toBe(html);
  });

  it('uses copy passed through the provider, including a replacement caption', () => {
    const messages: SharedMessages = JSON.parse(JSON.stringify(getMessages()));
    Object.assign(messages.diagrams, { landVsOwn: '差し替えた説明' });
    expect(render(<LandVsOwn />, messages)).toContain('<figcaption>差し替えた説明</figcaption>');
    expect(render(<LandVsOwn />)).toContain(getMessages().diagrams.landVsOwn);
  });

  it('escapes text and attribute values instead of interpreting them as HTML or SVG', () => {
    const malicious = '\"><script>alert(1)</script><path onload="alert(2)"/>';
    const html = render(
      <Figure
        wide={<text>{malicious}</text>}
        label={malicious}
        caption={malicious}
        viewBox="0 0 340 100"
      />,
    );
    const document = parseFragment(html);
    expect(elements(document, 'script')).toHaveLength(0);
    expect(elements(document, 'path').every((path) => attr(path, 'onload') === undefined)).toBe(
      true,
    );
    expect(attr(elements(document, 'svg')[0]!, 'aria-label')).toBe(malicious);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('class="fig-hint" aria-hidden="true"');
  });

  it('retains short dates when catalog dates contain spaces', () => {
    const spaced = render(
      <SubsidyTimeline form4="2026 年 12 月 4 日（金）" deadline="2026 年 12 月 15 日（火）" />,
    );
    const compact = render(
      <SubsidyTimeline form4="2026年12月4日（金）" deadline="2026年12月15日（火）" />,
    );
    expect(spaced).toBe(compact);
    expect(spaced).toContain('12/4');
    expect(spaced).toContain('12/15');
  });
});
