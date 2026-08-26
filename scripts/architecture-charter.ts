#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { serializeDeterministic } from '../src/lib/architecture-census/serialize';
import { privacyViolation } from '../src/lib/architecture-census/privacy';
import type { CensusCore, MeasurementReceipt } from '../src/lib/architecture-census/types';
import {
  charterIdentity,
  generateArchitectureCharter,
  projectCharterDocuments,
  qualifyArchitectureCharter,
} from '../src/lib/architecture-charter';

function main(): void {
  const repoRoot = process.cwd();
  const baselineDir = join(repoRoot, 'docs/architecture/modular-monolith/baseline');
  const outDir = join(repoRoot, 'docs/architecture');
  const censusCoreText = readFileSync(join(baselineDir, 'census-core.json'), 'utf8');
  const core = JSON.parse(censusCoreText) as CensusCore;
  const receipts = JSON.parse(readFileSync(join(baselineDir, 'receipts.json'), 'utf8')) as MeasurementReceipt[];
  const { charter, failures } = generateArchitectureCharter(core, receipts, {
    censusCoreText,
    requireFrozenArtifacts: true,
  });
  if (failures.length > 0) console.error(failures);
  qualifyArchitectureCharter(charter, failures);
  mkdirSync(outDir, { recursive: true });
  const serialized = serializeDeterministic(charter);
  writeFileSync(join(outDir, 'modular-monolith-charter.json'), serialized);
  writeFileSync(join(outDir, 'modular-monolith-charter.sha256'), `${charterIdentity(charter)}\n`);
  const documents = projectCharterDocuments(charter);
  for (const [name, content] of Object.entries(documents)) {
    const path = join(outDir, name);
    const normalized = content.replace(/\n+$/u, '\n');
    const violation = privacyViolation(normalized);
    if (violation) throw new Error(`${violation}:${name}`);
    writeFileSync(path, normalized);
  }
  console.log(`wrote charter ${charterIdentity(charter)} owners=${charter.owners.length} gates=${charter.gates.length}`);
}

main();
