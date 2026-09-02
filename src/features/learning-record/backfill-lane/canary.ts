import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { listOrdinaryBackfillPaths } from './inventory';
import { BackfillLaneError } from './types';

const SKIP_DIR_NAMES = new Set(['node_modules', '.next', 'dist', 'coverage', '__tests__', 'tests', '.git']);
const ONLINE_ROOTS = ['src/app', 'src/features', 'scripts/workers'];
const BACKFILL_IMPORT_RE = /from\s+['"][^'"]*(course-evidence-backfill|historical-evidence-materialization|backfill-learning-facts-from-|materialize-historical-learning-facts|unit-4-4-backfill|backfill-unit-4-)[^'"]*['"]/u;
const IGNORE_ONLINE = [
  'src/features/learning-record/backfill-lane/',
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
    if (!entry.isFile() || !/\.(?:[cm]?[jt]sx?)$/u.test(entry.name) || /\.(?:test|spec)\./u.test(entry.name)) continue;
    files.push(childRel.replace(/\\/g, '/'));
  }
  return files;
}

export function assertOnlineDoesNotImportBackfill(repositoryRoot: string): string[] {
  const offenders: string[] = [];
  for (const rootName of ONLINE_ROOTS) {
    const base = path.join(repositoryRoot, rootName);
    if (!existsSync(base) || !statSync(base).isDirectory()) continue;
    for (const rel of walk(repositoryRoot, rootName)) {
      if (IGNORE_ONLINE.some((prefix) => rel.startsWith(prefix))) continue;
      const source = readFileSync(path.join(repositoryRoot, rel), 'utf8');
      if (BACKFILL_IMPORT_RE.test(source)) offenders.push(rel);
    }
  }
  if (offenders.length > 0) {
    throw new BackfillLaneError('online-import', `Online modules import backfill: ${offenders.join(', ')}`);
  }
  return offenders;
}

export function assertOrdinaryBackfillDoesNotPublishCurrent(repositoryRoot: string): string[] {
  const offenders: string[] = [];
  for (const rel of new Set(listOrdinaryBackfillPaths())) {
    const absolute = path.join(repositoryRoot, rel);
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, 'utf8');
    if (source.includes('publishCurrentPointer')) offenders.push(rel);
  }
  if (offenders.length > 0) {
    throw new BackfillLaneError(
      'current-pointer-forbidden',
      `Ordinary backfill publishes current pointer: ${offenders.join(', ')}`,
    );
  }
  return offenders;
}
