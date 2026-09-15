/**
 * 顧客向け書面の共通形。同じ中身から Markdown と印刷用 HTML を作る。
 * HTML は JavaScript・外部読み込み・イベント属性を含めない（ADR 0036）。
 */
import { esc } from '@/lib/raw';

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'notice'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | {
      kind: 'table';
      head: readonly string[];
      rows: readonly (readonly string[])[];
      /** 列ごとの右寄せ。金額の列に使う。 */
      numeric?: readonly boolean[];
    };

export interface DocumentModel {
  title: string;
  blocks: readonly Block[];
}

const mdCell = (text: string) => text.replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
const mdLine = (text: string) => text.replace(/\r?\n/g, ' ');

export function renderMarkdown(doc: DocumentModel): string {
  const out = [`# ${mdLine(doc.title)}`, ''];
  for (const block of doc.blocks) {
    if (block.kind === 'heading') out.push(`## ${mdLine(block.text)}`, '');
    else if (block.kind === 'paragraph') out.push(mdLine(block.text), '');
    else if (block.kind === 'notice') out.push(`> ${mdLine(block.text)}`, '');
    else if (block.kind === 'list') {
      if (!block.items.length) continue;
      out.push(...block.items.map((item) => `- ${mdLine(item)}`), '');
    } else {
      out.push(`| ${block.head.map(mdCell).join(' | ')} |`);
      out.push(
        `| ${block.head.map((_, i) => (block.numeric?.[i] ? '---:' : '---')).join(' | ')} |`,
      );
      for (const row of block.rows) out.push(`| ${row.map(mdCell).join(' | ')} |`);
      out.push('');
    }
  }
  return out.join('\n');
}

const STYLE = `@page{size:A4;margin:16mm}
body{font-family:"Hiragino Sans","Noto Sans JP",sans-serif;color:#222;line-height:1.7;margin:0 auto;max-width:180mm;padding:8mm}
h1{font-size:20pt;margin:0 0 6mm}h2{font-size:13pt;margin:8mm 0 3mm;border-bottom:1px solid #999}
table{border-collapse:collapse;width:100%;margin:0 0 4mm;font-size:10pt}
th,td{border:1px solid #999;padding:1.5mm 2mm;vertical-align:top;text-align:left}
th{background:#f2f2f2}.num{text-align:right;white-space:nowrap}
.notice{border:1px solid #b36b00;background:#fff6e5;padding:2mm 3mm}
@media print{body{padding:0}}`;

export function renderHtml(doc: DocumentModel): string {
  const body = doc.blocks
    .map((block) => {
      if (block.kind === 'heading') return `<h2>${esc(block.text)}</h2>`;
      if (block.kind === 'paragraph') return `<p>${esc(block.text)}</p>`;
      if (block.kind === 'notice') return `<p class="notice">${esc(block.text)}</p>`;
      if (block.kind === 'list')
        return block.items.length
          ? `<ul>${block.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
          : '';
      const cls = (i: number) => (block.numeric?.[i] ? ' class="num"' : '');
      return `<table><thead><tr>${block.head.map((h, i) => `<th${cls(i)}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${block.rows
        .map((row) => `<tr>${row.map((c, i) => `<td${cls(i)}>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;
    })
    .filter(Boolean)
    .join('\n');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(doc.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<h1>${esc(doc.title)}</h1>
${body}
</body>
</html>
`;
}

/** 円の表記。書面では 3 桁区切りと「円」だけにし、計算値をそのまま出す。 */
export const yen = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US')}円`;
export const signedYen = (n: number) => (n > 0 ? `+${yen(n)}` : n === 0 ? '±0円' : yen(n));
