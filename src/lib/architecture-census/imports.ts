import { dirname, join, posix } from 'node:path';

import { isGeneratedPath, isSourcePath, isTestPath } from './classify';

const IMPORT_PATTERN = /(?:from\s+|import\(\s*|require\(\s*)['"]([^'"]+)['"]/gu;

export interface ResolvedImport {
  readonly from: string;
  readonly specifier: string;
  readonly to: string | null;
  readonly external: boolean;
}

function normalize(path: string): string {
  return path.replaceAll('\\', '/');
}

function candidates(resolved: string): string[] {
  if (/\.[a-z]+$/iu.test(resolved)) return [resolved];
  return [
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.mjs`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
    `${resolved}/index.js`,
  ];
}

export function extractSpecifiers(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(IMPORT_PATTERN)) {
    if (match[1]) found.add(match[1]);
  }
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
    for (const specifier of extractSpecifiers(content)) {
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
