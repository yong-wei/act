#!/usr/bin/env tsx
/**
 * Stage successor domain-fragment Teaching into a runtime tree.
 * This is not a production selector mutation and does not rematerialize shards.
 */

import path from 'node:path';

import {
  DEFAULT_SUCCESSOR_CANDIDATE_RELATIVE,
  stageDomainTeachingRuntimeFromCandidate,
} from '@/lib/authority-domain-shards/stage-domain-teaching-runtime';

const ROOT = process.cwd();

function fail(message: string): never {
  throw new Error(`stage-successor-domain-teaching-runtime: ${message}`);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value !== undefined && (!value || value.startsWith('--'))) fail(`missing ${name}`);
  return value;
}

function absolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function main(): void {
  const repoRoot = absolute(option('--out') ?? ROOT);
  const candidateDir = absolute(option('--candidate') ?? DEFAULT_SUCCESSOR_CANDIDATE_RELATIVE);
  const relative = option('--relative');
  const staged = stageDomainTeachingRuntimeFromCandidate({
    repoRoot,
    candidateDir,
    relative,
  });
  process.stdout.write(`${JSON.stringify({
    projectionId: staged.pointer.projectionId,
    projectionHash: staged.pointer.projectionHash,
    teachingCacheFamily: staged.pointer.teachingCacheFamily,
    relationCount: staged.artifacts.manifest.relationCount,
    files: staged.files.length,
  }, null, 2)}\n`);
}

main();
