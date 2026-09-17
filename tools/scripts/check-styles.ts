/** Keep static presentation in src/styles/, allowing only data-driven CSS variables in JSX. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ROOT } from '../paths';

export function checkInlineStyles(text: string, filename = 'component.tsx'): string[] {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const problems: string[] = [];
  function variablesOnly(node: ts.Node): boolean {
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
      return variablesOnly(node.expression);
    if (ts.isIdentifier(node) && node.text === 'undefined') return true;
    if (ts.isConditionalExpression(node))
      return variablesOnly(node.whenTrue) && variablesOnly(node.whenFalse);
    return (
      ts.isObjectLiteralExpression(node) &&
      node.properties.every(
        (p) =>
          ts.isPropertyAssignment(p) && ts.isStringLiteral(p.name) && p.name.text.startsWith('--'),
      )
    );
  }
  function visit(node: ts.Node) {
    if (
      !filename.endsWith('/components/Action.tsx') &&
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === 'className' &&
      node.initializer
    ) {
      function checkActionClass(value: ts.Node) {
        if (ts.isStringLiteralLike(value) && /(?:^|\s)btn(?:-[12])?(?:\s|$)/.test(value.text))
          problems.push(
            `${filename}: use ActionLink / ActionButton or variant on PhoneLink / ContactAction`,
          );
        ts.forEachChild(value, checkActionClass);
      }
      checkActionClass(node.initializer);
    }
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'style') {
      const initializer = node.initializer;
      if (
        !initializer ||
        !ts.isJsxExpression(initializer) ||
        !initializer.expression ||
        !variablesOnly(initializer.expression)
      ) {
        const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        problems.push(
          `${filename}:${line}: static style belongs in src/styles/ (only CSS variables are allowed)`,
        );
      }
    }
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(source) === 'style'
    ) {
      problems.push(`${filename}: inline <style> belongs in src/styles/`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return problems;
}

/** Shared typography and radii must remain adjustable from the theme. SVG geometry is separate. */
export function checkDesignValues(text: string, filename: string): string[] {
  if (filename.endsWith('tokens.css') || filename.endsWith('og.css')) return [];
  const shared = /\b(?:text-\[(?:14|15|16|18|20)px\]|rounded-\[(?:4|8)px\])/g;
  return [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(shared)].map(
    (match) =>
      `${filename}: ${match[0]} must use the shared typography/radius token (design.tokens.json)`,
  );
}

export function checkStyleSources(root: string): string[] {
  const problems: string[] = [];
  function styles(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) styles(file);
      else if (entry.name.endsWith('.css'))
        problems.push(...checkDesignValues(readFileSync(file, 'utf8'), file));
    }
  }
  styles(join(root, 'src', 'styles'));
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (file !== join(root, 'src', 'styles')) visit(file);
      } else if (/\.(css|scss|sass|less)$/.test(entry.name))
        problems.push(`${relative(root, file)}: styles must be centralized in src/styles/`);
      else if (/\.tsx?$/.test(entry.name))
        problems.push(...checkInlineStyles(readFileSync(file, 'utf8'), file));
    }
  }
  visit(join(root, 'src'));
  return problems;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const problems = checkStyleSources(ROOT);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      'check-styles: static styles are centralized; inline values are CSS variables only',
    );
}
