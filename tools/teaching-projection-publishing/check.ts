import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { worktreeIsClean } from '../boundary/git-source';
import { findProductToolEdges } from '../boundary/product-imports';
import { listTracked } from '../migration-backfill/classify';
import type { PublishingReceipt } from './types';
import { TEACHING_PROJECTION_PUBLISHING_SCHEMA_VERSION } from './types';

const RETIRED_PREFIXES = [
  'src/lib/teaching-projection/publish/',
  'src/lib/teaching-projection/qualify/',
  'src/lib/teaching-projection/rebase/',
] as const;

const IMPLEMENTATION_ROOTS = [
  'tools/teaching-projection-publishing/publish',
  'tools/teaching-projection-publishing/qualify',
  'tools/teaching-projection-publishing/rebase',
] as const;

export interface PublishingCheckResult {
  readonly ok: boolean;
  readonly failures: string[];
  readonly files: readonly string[];
  readonly callers: readonly string[];
  readonly receipt: PublishingReceipt;
}

function digest(value: string): string {
  return createHash('sha256').update(`${value}\n`).digest('hex');
}

function trackedPrefix(cwd: string, prefix: string): string[] {
  return listTracked(cwd, prefix);
}

export function checkTeachingProjectionPublishing(cwd: string): PublishingCheckResult {
  const failures: string[] = [];
  if (!worktreeIsClean(cwd)) failures.push('dirty-worktree');
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd, encoding: 'utf8' }).trim();
  const files = IMPLEMENTATION_ROOTS.flatMap((root) => trackedPrefix(cwd, root)).sort((left, right) => left.localeCompare(right));
  if (files.length !== 40) failures.push(`implementation-count:${files.length}`);
  const publish = files.filter((path) => path.startsWith('tools/teaching-projection-publishing/publish/'));
  const qualify = files.filter((path) => path.startsWith('tools/teaching-projection-publishing/qualify/'));
  const rebase = files.filter((path) => path.startsWith('tools/teaching-projection-publishing/rebase/'));
  if (publish.length !== 10) failures.push(`publish-count:${publish.length}`);
  if (qualify.length !== 14) failures.push(`qualify-count:${qualify.length}`);
  if (rebase.length !== 16) failures.push(`rebase-count:${rebase.length}`);

  for (const prefix of RETIRED_PREFIXES) {
    const leftover = trackedPrefix(cwd, prefix.replace(/\/$/, ''));
    if (leftover.length > 0) failures.push(`retired-authority-present:${prefix}`);
  }

  const productIndex = join(cwd, 'src/lib/teaching-projection/index.ts');
  if (existsSync(productIndex) && readFileSync(productIndex, 'utf8').includes("from './rebase'")) {
    failures.push('product-barrel-exports-rebase');
  }

  const scanRoots = [
    ...listTracked(cwd, 'src'),
    ...listTracked(cwd, 'scripts'),
  ];
  const callers = new Set<string>();
  for (const path of scanRoots) {
    if (!/\.(?:[cm]?[jt]sx?)$/.test(path)) continue;
    if (path.startsWith('tools/teaching-projection-publishing/')) continue;
    const content = readFileSync(join(cwd, path), 'utf8');
    const importSpecs = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    if (importSpecs.some((spec) => (
      /(?:^|\/)teaching-projection\/(publish|qualify|rebase)(?:\/|$)/.test(spec)
      && !spec.includes('tools/teaching-projection-publishing/')
    ))) {
      failures.push(`retired-import:${path}`);
    }
    if (content.includes('tools/teaching-projection-publishing/')) callers.add(path);
  }

  const productFiles = scanRoots.filter((path) => (
    path.startsWith('src/')
    && !path.includes('/__tests__/')
    && !/\.(?:test|spec)\./.test(path)
  ));
  for (const edge of findProductToolEdges(cwd, productFiles)) {
    if (edge.to.startsWith('tools/teaching-projection-publishing/')) {
      failures.push(`product-to-publishing-cli:${edge.from}->${edge.to}`);
    }
  }

  const inputDigest = digest(files.join('\n'));
  const receipt: PublishingReceipt = {
    schemaVersion: TEACHING_PROJECTION_PUBLISHING_SCHEMA_VERSION,
    commandId: 'teaching-projection:check',
    sourceRevision,
    sourceTree,
    inputDigest,
    outputDigest: digest(failures.join('\n')),
    fileCount: files.length,
    callerCount: callers.size,
    status: failures.length === 0 ? 'ok' : 'failed',
    executed: false,
    productionActivation: false,
  };
  return { ok: failures.length === 0, failures, files, callers: [...callers].sort(), receipt };
}
