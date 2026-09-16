import { parse, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
/** Inspect parsed markup, including template contents and decoded attribute entities. */
export function unsafeMarkup(source: string): string[] {
  const issues: string[] = [];
  const visit = (node: Node) => {
    if ('tagName' in node) {
      const attr = (name: string) => node.attrs.find((a) => a.name === name)?.value;
      if (
        [
          'iframe',
          'object',
          'embed',
          'base',
          'foreignObject',
          'animate',
          'animateMotion',
          'animateTransform',
          'set',
        ].includes(node.tagName)
      )
        issues.push(`forbidden element: ${node.tagName}`);
      if (node.tagName === 'script') {
        if (
          attr('type')?.trim().toLowerCase() !== 'application/ld+json' ||
          attr('src') !== undefined
        )
          issues.push('executable or external script');
        else {
          try {
            JSON.parse(node.childNodes.map((n) => ('value' in n ? n.value : '')).join(''));
          } catch {
            issues.push('invalid JSON-LD');
          }
        }
      }
      if (node.tagName === 'style') issues.push('inline stylesheet');
      if (node.tagName === 'meta' && attr('http-equiv')?.toLowerCase() === 'refresh')
        issues.push('automatic redirect');
      for (const { name, value } of node.attrs) {
        if (/^on/i.test(name)) issues.push(`event handler: ${name}`);
        if (name === 'srcdoc') issues.push('inline document');
        if (
          name === 'style' &&
          !/^(?:--comparison-width:(?:100|[0-9]{1,2})(?:\.[0-9]+)?%|--table-min-width:[0-9]+px);?$/.test(
            value,
          )
        )
          issues.push('unexpected inline style');
        if (['href', 'src', 'action', 'formaction'].includes(name)) {
          const url = value.replace(/[\u0000-\u0020\u007f]/g, '').toLowerCase();
          if (
            /^(javascript|vbscript):/.test(url) ||
            (url.startsWith('data:') &&
              !(
                ['img', 'image'].includes(node.tagName) &&
                /^data:image\/(?:png|jpeg|webp|gif|avif);base64,/.test(url)
              ))
          )
            issues.push(`unsafe URL in ${name}`);
        }
      }
      if (node.tagName === 'template') visit((node as DefaultTreeAdapterMap['template']).content);
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  };
  visit(parse(source));
  return issues;
}
