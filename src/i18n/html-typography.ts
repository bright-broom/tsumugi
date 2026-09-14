import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { japaneseSpacing, needsJapaneseSpace } from '@/i18n/typography';
import { esc } from '@/lib/raw';

type Node = DefaultTreeAdapterMap['node'];
type TextNode = DefaultTreeAdapterMap['textNode'];
const inline = new Set([
  'a',
  'span',
  'b',
  'strong',
  'em',
  'i',
  'small',
  'mark',
  's',
  'u',
  'abbr',
  'sub',
  'sup',
]);
const protectedTags = new Set(['script', 'style', 'code', 'pre', 'textarea', 'kbd', 'samp']);
const textAttributes = new Set([
  'alt',
  'title',
  'aria-label',
  'aria-description',
  'placeholder',
  'data-h',
]);

/** Patch text ranges, preserving URLs, markup, scripts and SVG geometry verbatim. */
export function spaceHtml(html: string, acrossInline = true): string {
  const tree = parseFragment(html, { sourceCodeLocationInfo: true });
  const patches: { start: number; end: number; value: string }[] = [];
  let run: TextNode[] = [];
  const flush = () => {
    let previous = '';
    for (const node of run) {
      let value = japaneseSpacing(node.value);
      if (acrossInline && value && needsJapaneseSpace(previous, [...value][0]!))
        value = ' ' + value;
      if (value) previous = [...value].at(-1)!;
      const location = node.sourceCodeLocation;
      if (location && value !== node.value)
        patches.push({ start: location.startOffset, end: location.endOffset, value: esc(value) });
    }
    run = [];
  };
  function visit(node: Node) {
    if (node.nodeName === '#text' && 'value' in node) {
      run.push(node);
      return;
    }
    if ('tagName' in node) {
      if (protectedTags.has(node.tagName)) {
        flush();
        return;
      }
      for (const attribute of node.attrs) {
        const isTextMeta =
          node.tagName === 'meta' &&
          attribute.name === 'content' &&
          node.attrs.some(
            (a) =>
              ['name', 'property'].includes(a.name) &&
              ['description', 'og:title', 'og:description', 'og:site_name'].includes(a.value),
          );
        if (!textAttributes.has(attribute.name) && !isTextMeta) continue;
        const value = japaneseSpacing(attribute.value);
        const location = node.sourceCodeLocation?.attrs?.[attribute.name];
        if (location && value !== attribute.value)
          patches.push({
            start: location.startOffset,
            end: location.endOffset,
            value: `${attribute.name}="${esc(value)}"`,
          });
      }
      if (!inline.has(node.tagName)) flush();
      for (const child of node.childNodes) visit(child);
      if (!inline.has(node.tagName)) flush();
    } else if ('childNodes' in node) for (const child of node.childNodes) visit(child);
  }
  visit(tree);
  flush();
  return patches
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, patch) => result.slice(0, patch.start) + patch.value + result.slice(patch.end),
      html,
    );
}

/** Catalog text can contain trusted HTML, but plain text must not acquire HTML entities. */
export function spaceCopy(value: string): string {
  return /<[a-z][^>]*>/i.test(value) ? spaceHtml(value) : japaneseSpacing(value);
}
