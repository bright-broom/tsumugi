import ts from 'typescript';

const visibleFields = new Set([
  'aria-label',
  'aria-description',
  'alt',
  'title',
  'placeholder',
  'heading',
  'lede',
  'caption',
  'eyebrow',
  'label',
  'summary',
  'description',
  'message',
  'question',
  'answer',
]);

/** Follow only expression branches that deliver text, not function arguments or IDs. */
function isVisibleValue(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isJsxAttribute(parent)) return visibleFields.has(parent.name.getText());
  if (ts.isPropertyAssignment(parent) && parent.initializer === node)
    return visibleFields.has(parent.name.getText().replace(/^['"]|['"]$/g, ''));
  if (ts.isJsxExpression(parent))
    return ts.isJsxAttribute(parent.parent)
      ? visibleFields.has(parent.parent.name.getText())
      : ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent);
  if (
    ts.isParenthesizedExpression(parent) ||
    ts.isAsExpression(parent) ||
    ts.isSatisfiesExpression(parent) ||
    ts.isTemplateExpression(parent) ||
    ts.isTemplateSpan(parent) ||
    (ts.isConditionalExpression(parent) && parent.condition !== node) ||
    (ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.PlusToken ||
        parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        parent.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
          parent.right === node)))
  )
    return isVisibleValue(parent);
  return false;
}

/** Source policy for copy and URLs; comments and technical identifiers are deliberately ignored. */
export function inspectSource(file: string, source: string): string[] {
  if (file.includes('/i18n/locales/')) return [];
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const problems: string[] = [];
  const report = (node: ts.Node, message: string) => {
    const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
    problems.push(`${file}:${line}: ${message}`);
  };
  function visit(node: ts.Node) {
    if (ts.isJsxText(node) && node.text.trim())
      report(node, 'Visible JSX text must come from the catalog');
    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      if (
        /[ぁ-んァ-ン一-龠]/u.test(node.text) ||
        (/\p{L}/u.test(node.text) && isVisibleValue(node))
      )
        report(node, 'Localizable text must come from the catalog');
      if (/^[a-z0-9-]+\.html(?:#.*)?$/.test(node.text))
        report(node, 'Use the typed route registry');
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return problems;
}
