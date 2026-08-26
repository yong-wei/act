#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { serializeDeterministic, sha256Text } from '../src/lib/architecture-census/serialize';
import type { CensusCore } from '../src/lib/architecture-census/types';
import { assertFitness, checkFitness, createAllowlist } from '../src/lib/architecture-fitness';

function main(): void {
  const repoRoot = process.cwd();
  const core = JSON.parse(readFileSync(join(repoRoot, 'docs/architecture/modular-monolith/baseline/census-core.json'), 'utf8')) as CensusCore;
  const charterSha256 = readFileSync(join(repoRoot, 'docs/architecture/modular-monolith-charter.sha256'), 'utf8').trim();
  const allowlist = createAllowlist(core, charterSha256);
  const report = checkFitness(core, allowlist);
  assertFitness(report);
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
  const rulesPath = join(repoRoot, 'docs/architecture/dependency-rules.md');
  const ledgerPath = join(repoRoot, 'docs/architecture/deprecation-ledger.md');
  const stamp = `\nFitness allowlist identity: \`${sha256Text(serialized)}\`. Remaining staged entries: ${allowlist.entries.length}.\n`;
  for (const path of [rulesPath, ledgerPath]) {
    const current = readFileSync(path, 'utf8');
    const withoutStamp = current.replace(/\nFitness allowlist identity:.*\n?/gu, '\n');
    writeFileSync(path, `${withoutStamp.replace(/\n+$/u, '\n')}${stamp}`);
  }
  console.log(`allowlist ${allowlist.entries.length} ok=${report.ok}`);
}

main();
