/**
 * 本文の多くは <strong> や <br> を含む HTML 文字列で持っている（Python 版からの移し替え）。
 * React に流し込むときは必ずここを通す。自前のデータだけを渡すこと。
 *
 * 渡された HTML は、装飾と自サイトへのリンク・アイコンの SVG だけに限る（ADR 0087）。
 * 許可していないタグ・属性・リンク先があればビルドを止める。公開ページには JavaScript を
 * 載せないので、この検査が動くのはビルド（静的書き出し）のときだけ。
 */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  strong: ['class'],
  em: [],
  br: [],
  p: ['class'],
  span: ['class'],
  a: ['href', 'class'],
  // components/Icon の ic() が出すアイコン（Lucide）の SVG
  svg: [
    'width',
    'height',
    'viewbox',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'class',
    'aria-hidden',
    'focusable',
  ],
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['width', 'height', 'x', 'y', 'rx', 'ry'],
  line: ['x1', 'x2', 'y1', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
};

/** 自サイトの中（/・#）、電話・メール、https の外部だけ。javascript: などは通さない。 */
const SAFE_HREF = /^(?:\/(?!\/)|#|tel:|mailto:|https:\/\/)/i;

const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:=(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*\/?>/g;
const ATTR = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;

/** 許可していないものを「何が・どこで」の一覧で返す（空なら安全）。 */
export function unsafeHtml(html: string): string[] {
  const problems: string[] = [];
  let tags = 0;
  for (const [, closing, rawName, attrs = ''] of html.matchAll(TAG)) {
    tags += 1;
    const name = rawName!.toLowerCase();
    const allowed = ALLOWED[name];
    if (!allowed) {
      problems.push(`tag not allowed: <${closing}${name}>`);
      continue;
    }
    if (closing) continue;
    for (const [, rawAttr, dq, sq, bare] of attrs.matchAll(ATTR)) {
      const attr = rawAttr!.toLowerCase();
      if (!allowed.includes(attr)) problems.push(`attribute not allowed on <${name}>: ${attr}`);
      else if (attr === 'href' && !SAFE_HREF.test((dq ?? sq ?? bare ?? '').trim()))
        problems.push(`href not allowed: ${dq ?? sq ?? bare ?? ''}`);
    }
  }
  // タグとして読めない「<文字」（閉じていない <script など）も、ブラウザが要素として解釈しうる
  const opens = html.match(/<\/?[a-zA-Z]/g)?.length ?? 0;
  if (opens !== tags) problems.push('unterminated tag (a "<" that does not close)');
  return problems;
}

export const raw = (html: string) => {
  const problems = unsafeHtml(html);
  if (problems.length)
    throw new Error(
      `raw() received HTML outside the allowlist (ADR 0087):\n${problems.join('\n')}\nin: ${html.slice(0, 200)}`,
    );
  return { __html: html };
};

/** 文字列を HTML の中に組み込むとき用 */
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Keep JSON data inside its script element even when values contain HTML end tags. */
export const jsonLd = (value: unknown) => ({
  __html: JSON.stringify(value, null, 2).replace(/</g, '\\u003c'),
});
