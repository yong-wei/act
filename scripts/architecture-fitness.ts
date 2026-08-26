#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateCensusCore, loadGitSourceSnapshot } from '../src/lib/architecture-census';
import { serializeDeterministic, sha256Text } from '../src/lib/architecture-census/serialize';
import type { CensusCore } from '../src/lib/architecture-census/types';
import { REQUIRED_BASELINE } from '../src/lib/architecture-charter';
import { assertFitness, checkFitness, createAllowlist } from '../src/lib/architecture-fitness';
import type { FitnessAllowlist } from '../src/lib/architecture-fitness';

function writeAllowlist(repoRoot: string, allowlist: FitnessAllowlist): string {
  const serialized = serializeDeterministic(allowlist);
  writeFileSync(join(repoRoot, 'docs/architecture/dependency-allowlist.json'), serialized);
  writeFileSync(join(repoRoot, 'docs/architecture/dependency-allowlist.sha256'), `${sha256Text(serialized)}\n`);
  const summary = [
    '# Dependency allowlist',
    '',
    `- schemaVersion: \`${allowlist.schemaVersion}\``,
    `- baselineSourceCommit: \`${allowlist.baselineSourceCommit}\``,
    `- charterSha256: \`${allowlist.charterSha256}\``,
    `- entries: ${allowlist.entries.length}`,
    `- feature-to-app: ${allowlist.entries.filter((item) => item.kind === 'feature-to-app').length}`,
    `- deep-import: ${allowlist.entries.filter((item) => item.kind === 'deep-import').length}`,
    `- domain-core-infrastructure: ${allowlist.entries.filter((item) => item.kind === 'domain-core-infrastructure').length}`,
    `- scc: ${allowlist.entries.filter((item) => item.kind === 'scc').length}`,
    `- lib-file: ${allowlist.entries.filter((item) => item.kind === 'lib-file').length}`,
    '',
    'Existing debt remains staged. Entries and forbidden edges may only decrease. This check does not activate production or claim repository-wide migration.',
    '',
    'First deletion slice: `decouple-teacher-diagnosis-route-contract`.',
    '',
  ].join('\n');
  writeFileSync(join(repoRoot, 'docs/architecture/dependency-allowlist.md'), summary);
  const stamp = `\nFitness allowlist identity: \`${sha256Text(serialized)}\`. Remaining staged entries: ${allowlist.entries.length}.\n`;
  for (const name of ['dependency-rules.md', 'deprecation-ledger.md']) {
    const path = join(repoRoot, 'docs/architecture', name);
    const current = readFileSync(path, 'utf8');
    const withoutStamp = current.replace(/\nFitness allowlist identity:.*\n?/gu, '\n');
    writeFileSync(path, `${withoutStamp.replace(/\n+$/u, '\n')}${stamp}`);
  }
  return sha256Text(serialized);
}

function main(): void {
  const repoRoot = process.cwd();
  const write = process.argv.includes('--write-allowlist');
  const charterSha256 = readFileSync(join(repoRoot, 'docs/architecture/modular-monolith-charter.sha256'), 'utf8').trim();
  if (write) {
    const frozen = JSON.parse(readFileSync(join(repoRoot, 'docs/architecture/modular-monolith/baseline/census-core.json'), 'utf8')) as CensusCore;
    if (frozen.captureIdentity.sourceCommit !== REQUIRED_BASELINE.sourceCommit) {
      throw new Error('baseline-commit-drift');
    }
    const snapshot = loadGitSourceSnapshot(repoRoot);
    const frozenPaths = new Set(frozen.observations.flatMap((item) => [
      item.identity,
      ...item.evidence,
      String(item.attributes.from ?? ''),
      String(item.attributes.to ?? ''),
    ]));
    const files = snapshot.files.filter((file) => frozenPaths.has(file.path));
    const allowlist = createAllowlist(frozen, charterSha256, files);
    const hash = writeAllowlist(repoRoot, allowlist);
    console.log(`wrote allowlist ${allowlist.entries.length} ${hash}`);
    return;
  }
  const snapshot = loadGitSourceSnapshot(repoRoot);
  if (snapshot.dirty) throw new Error('dirty-worktree');
  if (snapshot.mixedWorktree) throw new Error('mixed-worktree');
  const { core } = generateCensusCore(snapshot);
  const allowlist = JSON.parse(readFileSync(join(repoRoot, 'docs/architecture/dependency-allowlist.json'), 'utf8')) as FitnessAllowlist;
  const report = checkFitness(core, allowlist, snapshot.files);
  assertFitness(report);
  console.log(`fitness ok remaining=${report.remaining.length} current=${report.currentCount}`);
}

main();
