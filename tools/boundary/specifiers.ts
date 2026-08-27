import ts from 'typescript';

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.(?:js|mjs|cjs)$/u.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

export function extractSpecifiers(path: string, content: string): string[] {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKind(path));
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        found.add(node.moduleSpecifier.text);
      }
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        found.add(node.arguments[0].text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found].sort();
}

export function extractStringLiterals(path: string, content: string): string[] {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKind(path));
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      found.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found].sort();
}

const PATH_JOIN_CALLEES = new Set([
  'join',
  'resolve',
  'path.join',
  'path.resolve',
  'posix.join',
  'posix.resolve',
  'win32.join',
  'win32.resolve',
]);

const REPO_ROOT_IDENTIFIERS = new Set([
  'cwd',
  'repoRoot',
  'repositoryRoot',
  'root',
  'processCwd',
]);

function calleeKey(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text;
  if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.name)) return null;
  const name = expression.name.text;
  if (ts.isIdentifier(expression.expression)) return `${expression.expression.text}.${name}`;
  if (ts.isPropertyAccessExpression(expression.expression) && ts.isIdentifier(expression.expression.name)) {
    return `${expression.expression.name.text}.${name}`;
  }
  return name;
}

function isProcessCwd(node: ts.Node): boolean {
  return ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && ts.isIdentifier(node.expression.expression)
    && node.expression.expression.text === 'process'
    && ts.isIdentifier(node.expression.name)
    && node.expression.name.text === 'cwd'
    && node.arguments.length === 0;
}

function staticText(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isIdentifier(node) && REPO_ROOT_IDENTIFIERS.has(node.text)) return '';
  if (isProcessCwd(node)) return '';
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) {
      if (!(ts.isStringLiteral(span.expression) || ts.isNoSubstitutionTemplateLiteral(span.expression))) return null;
      text += span.expression.text + span.literal.text;
    }
    return text;
  }
  return null;
}

function normalizeJoinedPath(parts: readonly string[]): string | null {
  const resolved: string[] = [];
  for (const part of parts) {
    for (const segment of part.replace(/\\/g, '/').split('/')) {
      if (!segment || segment === '.') continue;
      if (segment === '..') {
        resolved.pop();
        continue;
      }
      resolved.push(segment);
    }
  }
  return resolved.length > 0 ? resolved.join('/') : null;
}

export function extractJoinedPaths(path: string, content: string): string[] {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKind(path));
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const key = calleeKey(node.expression);
      if (key && PATH_JOIN_CALLEES.has(key) && node.arguments.length > 0) {
        const parts: string[] = [];
        let complete = true;
        for (const argument of node.arguments) {
          if (ts.isSpreadElement(argument)) {
            complete = false;
            break;
          }
          const text = staticText(argument);
          if (text === null) {
            complete = false;
            break;
          }
          parts.push(text);
        }
        const joined = complete ? normalizeJoinedPath(parts) : null;
        if (joined) found.add(joined);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found].sort();
}
