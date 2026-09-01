import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { listWriteBoundaryEntries } from './inventory';
import { WriteBoundaryError } from './types';

const SKIP_DIR_NAMES = new Set(['node_modules', '.next', 'dist', 'coverage', '__tests__', 'tests', '.git']);

const PRODUCER_RE = [
  /ingestLearningFact\s*\(/u,
  /persistCoreLearningFact\s*\(/u,
  /write(?:Legacy|Canonical)?KnowledgeScopedLearningFacts\s*\(/u,
  /\.learningFact\.(create(?:Many|ManyAndReturn)?|upsert)\s*\(/u,
];

const IGNORE_SUFFIXES = [
  'src/features/learning-record/write-boundary/canary.ts',
  'src/features/learning-record/write-boundary/inventory.ts',
  'src/lib/canonical-learning-fact-identity/static-gate.ts',
];

function walk(root: string, relative = ''): string[] {
  const absolute = path.join(root, relative);
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const childRel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...walk(root, childRel));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(?:[cm]?[jt]sx?)$/u.test(entry.name)) continue;
    if (/\.(?:test|spec)\./u.test(entry.name)) continue;
    files.push(childRel.replace(/\\/g, '/'));
  }
  return files;
}

export function discoverWriteBoundaryPaths(repositoryRoot: string): string[] {
  const discovered = new Set<string>();
  for (const rootName of ['src', 'scripts']) {
    const base = path.join(repositoryRoot, rootName);
    if (!existsSync(base) || !statSync(base).isDirectory()) continue;
    for (const rel of walk(repositoryRoot, rootName)) {
      if (IGNORE_SUFFIXES.some((suffix) => rel.endsWith(suffix))) continue;
      const source = readFileSync(path.join(repositoryRoot, rel), 'utf8');
      if (PRODUCER_RE.some((pattern) => pattern.test(source))) {
        discovered.add(rel.replace(/\\/g, '/'));
      }
    }
  }
  return [...discovered].sort();
}

export function assertWriteBoundaryCanary(repositoryRoot: string): string[] {
  const discovered = discoverWriteBoundaryPaths(repositoryRoot);
  const known = new Set(listWriteBoundaryEntries());
  const missing = discovered.filter((file) => !known.has(file));
  if (missing.length > 0) {
    throw new WriteBoundaryError(
      'write-boundary-unclassified',
      `Unclassified Learning Record writers: ${missing.join(', ')}`,
    );
  }
  return discovered;
}
