import { dirname, join, posix } from 'node:path';
import ts from 'typescript';

import { isGeneratedPath, isSourcePath, isTestPath } from './classify';

export interface ResolvedImport {
  readonly from: string;
  readonly specifier: string;
  readonly to: string | null;
  readonly external: boolean;
}

function normalize(path: string): string {
  return path.replaceAll('\\', '/');
}

const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/iu;

function candidates(resolved: string): string[] {
  if (SOURCE_EXTENSION.test(resolved)) return [resolved];
  return [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.mjs`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
    `${resolved}/index.js`,
  ];
}

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.(?:js|mjs|cjs)$/u.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function addLiteral(found: Set<string>, node: ts.Expression | undefined): void {
  if (node && ts.isStringLiteralLike(node)) found.add(node.text);
}

export function extractSpecifiers(path: string, content: string): string[] {
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKind(path));
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addLiteral(found, node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addLiteral(found, node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword) addLiteral(found, node.arguments[0]);
      if (ts.isIdentifier(callee) && callee.text === 'require') addLiteral(found, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found].sort();
}

export function resolveImport(
  fromPath: string,
  specifier: string,
  files: ReadonlySet<string>,
): ResolvedImport {
  if (specifier.startsWith('.')) {
    const base = normalize(join(dirname(fromPath), specifier));
    const hit = candidates(base).find((path) => files.has(path));
    return { from: fromPath, specifier, to: hit ?? null, external: !hit };
  }
  if (specifier.startsWith('@/')) {
    const base = `src/${specifier.slice(2)}`;
    const hit = candidates(base).find((path) => files.has(path));
    return { from: fromPath, specifier, to: hit ?? null, external: !hit };
  }
  return { from: fromPath, specifier, to: null, external: true };
}

export function collectResolvedImports(
  files: ReadonlyMap<string, string>,
): ResolvedImport[] {
  const names = new Set(files.keys());
  const edges: ResolvedImport[] = [];
  for (const [path, content] of files) {
    if (!isSourcePath(path) || isGeneratedPath(path)) continue;
    for (const specifier of extractSpecifiers(path, content)) {
      edges.push(resolveImport(path, specifier, names));
    }
  }
  return edges.sort((left, right) => (
    left.from.localeCompare(right.from) || left.specifier.localeCompare(right.specifier)
  ));
}

export function importContext(path: string): 'production' | 'test' {
  return isTestPath(path) ? 'test' : 'production';
}

export { posix };
