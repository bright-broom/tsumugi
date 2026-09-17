/**
 * 配信された HTML から、公開後の確認に要る事実だけを取り出す。
 * 文字列の正規表現ではなく parse5 で読む（属性の順序・引用符・改行に左右されないように）。
 */
import { parse, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

export interface PageFacts {
  canonical: string[];
  ogUrl: string[];
  /** JSON-LD 以外の script（src か type を記録） */
  runtimeScripts: string[];
  /** onclick などのインラインイベントハンドラ */
  inlineHandlers: string[];
  links: string[];
  robots: string[];
}

const attribute = (element: Element, name: string) =>
  element.attrs.find((entry) => entry.name === name)?.value;

export function inspectHtml(html: string): PageFacts {
  const facts: PageFacts = {
    canonical: [],
    ogUrl: [],
    runtimeScripts: [],
    inlineHandlers: [],
    links: [],
    robots: [],
  };
  const visit = (node: Node, inert = false) => {
    if ('tagName' in node) {
      const element = node;
      if (!inert && element.tagName === 'a') facts.links.push(attribute(element, 'href') ?? '');
      if (
        !inert &&
        element.tagName === 'meta' &&
        ['robots', 'googlebot', 'bingbot'].includes(
          (attribute(element, 'name') ?? '').toLowerCase(),
        )
      )
        facts.robots.push(attribute(element, 'content') ?? '');
      const rel = (attribute(element, 'rel') ?? '').toLowerCase().split(/\s+/);
      if (element.tagName === 'link' && rel.includes('canonical'))
        facts.canonical.push(attribute(element, 'href') ?? '');
      if (
        element.tagName === 'meta' &&
        (attribute(element, 'property') ?? attribute(element, 'name')) === 'og:url'
      )
        facts.ogUrl.push(attribute(element, 'content') ?? '');
      if (element.tagName === 'script') {
        const type = (attribute(element, 'type') ?? '').trim().toLowerCase();
        if (type !== 'application/ld+json')
          facts.runtimeScripts.push(attribute(element, 'src') ?? (type || 'inline'));
      }
      for (const { name } of element.attrs)
        if (/^on[a-z]+$/i.test(name)) facts.inlineHandlers.push(`<${element.tagName} ${name}>`);
      if (element.tagName === 'template')
        visit((element as DefaultTreeAdapterMap['template']).content, true);
    }
    if ('childNodes' in node) for (const child of node.childNodes) visit(child, inert);
  };
  visit(parse(html));
  return facts;
}
