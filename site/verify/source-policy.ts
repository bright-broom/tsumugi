import ts from 'typescript';

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
      if (/[ぁ-んァ-ン一-龠]/u.test(node.text))
        report(node, 'Localizable text must come from the catalog');
      if (/^[a-z0-9-]+\.html(?:#.*)?$/.test(node.text))
        report(node, 'Use the typed route registry');
      if (
        ts.isJsxAttribute(node.parent) &&
        [
          'aria-label',
          'alt',
          'title',
          'placeholder',
          'heading',
          'lede',
          'caption',
          'eyebrow',
        ].includes(node.parent.name.getText(tree))
      ) {
        report(node, 'Visible attribute must come from the catalog');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return problems;
}
