import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { extractSpecifiers, extractStringLiterals } from './specifiers';

import type { ProductToolEdge, ProductToolPathRead } from './types';
import { SOURCE_FAMILIES } from './types';

const PRODUCTION_ROOTS = [
  'src/app/',
  'src/components/',
  'src/features/',
  'src/hooks/',
  'src/lib/',
  'src/resources/',
  'src/types/',
  'scripts/workers/',
];

const PRODUCTION_FILES = [
  'scripts/assignments/scan-submission-objects.ts',
  'scripts/assignments/gc-submission-objects.ts',
] as const;

function isTestPath(path: string): boolean {
  return path.includes('/__tests__/')
    || path.includes('/fixtures/')
    || /\.(?:test|spec)\./.test(path);
}

function isProductionPath(path: string): boolean {
  if (isTestPath(path)) return false;
  if ((PRODUCTION_FILES as readonly string[]).includes(path)) return true;
  return PRODUCTION_ROOTS.some((root) => path.startsWith(root));
}

export const PRODUCT_SCAN_ROOTS = [
  'src',
  'scripts/workers',
  ...PRODUCTION_FILES,
] as const;

function isToolImplementation(path: string): boolean {
  return SOURCE_FAMILIES.some((family) => (
    family.id !== 'artifacts'
    && (path === family.path || path.startsWith(`${family.path}/`))
  ));
}

function resolveLocal(fromPath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const fromDir = fromPath.split('/').slice(0, -1).join('/');
  const combined = `${fromDir}/${specifier}`.split('/');
  const resolved: string[] = [];
  for (const part of combined) {
    if (part === '.' || part === '') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

export function findProductToolEdges(cwd: string, trackedFiles: readonly string[]): ProductToolEdge[] {
  const files = new Set(trackedFiles);
  const edges: ProductToolEdge[] = [];
  for (const path of trackedFiles) {
    if (!isProductionPath(path) || !/\.(?:[cm]?[jt]sx?)$/.test(path)) continue;
    const content = readFileSync(join(cwd, path), 'utf8');
    const specifiers = extractSpecifiers(path, content);
    for (const specifier of specifiers) {
      const resolved = resolveLocal(path, specifier);
      if (!resolved) continue;
      const candidates = [
        resolved,
        `${resolved}.ts`,
        `${resolved}.tsx`,
        `${resolved}.js`,
        `${resolved}.mjs`,
        `${resolved}/index.ts`,
      ];
      const hit = candidates.find((candidate) => files.has(candidate))
        ?? (isToolImplementation(resolved) ? resolved : undefined);
      if (!hit || !isToolImplementation(hit)) continue;
      edges.push({
        from: path,
        to: hit,
        specifier,
        edgeClass: 'static-import',
      });
    }
  }
  return edges;
}

function isRecordedToolPath(value: string, files: ReadonlySet<string>): boolean {
  if (!value || value.includes('*') || value.includes('{')) return false;
  if (files.has(value)) return isToolImplementation(value);
  if (value.endsWith('/') && isToolImplementation(value.slice(0, -1))) {
    const prefix = value;
    for (const file of files) {
      if (file.startsWith(prefix)) return true;
    }
  }
  return false;
}

export function findProductToolPathReads(cwd: string, trackedFiles: readonly string[]): ProductToolPathRead[] {
  const files = new Set(trackedFiles);
  const reads: ProductToolPathRead[] = [];
  for (const path of trackedFiles) {
    if (!isProductionPath(path) || !/\.(?:[cm]?[jt]sx?)$/.test(path)) continue;
    const content = readFileSync(join(cwd, path), 'utf8');
    for (const value of extractStringLiterals(path, content)) {
      if (!isRecordedToolPath(value, files)) continue;
      reads.push({ from: path, to: value, kind: 'path-string' });
    }
  }
  return reads.sort((left, right) => (
    left.from === right.from ? left.to.localeCompare(right.to) : left.from.localeCompare(right.from)
  ));
}
