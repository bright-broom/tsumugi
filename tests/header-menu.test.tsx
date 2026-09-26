import { renderToStaticMarkup } from 'react-dom/server';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { describe, expect, it } from 'vitest';
import { ContentProvider } from '@/components/ContentProvider';
import Header from '@/components/Header';
import { getMessages } from '@/i18n/catalog';
import { ROUTES } from '@/routing/registry';

type Element = DefaultTreeAdapterMap['element'];
type Node = DefaultTreeAdapterMap['node'];

const all = (node: Node): Element[] => [
  ...('tagName' in node ? [node] : []),
  ...('childNodes' in node ? node.childNodes.flatMap(all) : []),
];
// HTML の属性名は大文字小文字を区別しない（parse5 は小文字にそろえる）
const attr = (node: Element, name: string) => node.attrs.find((a) => a.name === name)?.value;

const html = renderToStaticMarkup(
  <ContentProvider messages={getMessages()}>
    <Header file={ROUTES.price.file} />
  </ContentProvider>,
);
const nodes = all(parseFragment(html) as unknown as Node);

describe('ヘッダーのメニュー（ADR 0086）', () => {
  it('ブラウザ標準の popover で開閉し、実行時の JavaScript を使わない', () => {
    const toggle = nodes.find((n) => n.tagName === 'button' && attr(n, 'popovertarget'));
    expect(toggle, 'popover を開くボタン').toBeDefined();
    expect(attr(toggle!, 'type')).toBe('button');
    const panel = nodes.find((n) => attr(n, 'id') === attr(toggle!, 'popovertarget'));
    expect(panel, 'ボタンが指すパネル').toBeDefined();
    // auto：外側のクリック・Esc で閉じ（light dismiss）、外側の操作は遮らない
    expect(attr(panel!, 'popover')).toBe('auto');
    expect(html).not.toMatch(/<script|\son[a-z]+=/i);
  });

  it('外側クリックで閉じない details のメニューに戻さない', () => {
    expect(nodes.some((n) => n.tagName === 'details')).toBe(false);
  });

  it('パネルにはサイト内の案内がそろっている', () => {
    const panel = nodes.find((n) => attr(n, 'popover') === 'auto')!;
    const links = all(panel)
      .filter((n) => n.tagName === 'a')
      .map((n) => attr(n, 'href'));
    for (const route of [ROUTES.faq, ROUTES.contact, ROUTES.price])
      expect(links).toContain(`/${route.file}`);
  });
});
