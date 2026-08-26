#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readFileSync } from 'node:fs';

import {
  generateCensusCore,
  loadGitSourceSnapshot,
  projectAll,
  projectWithReceipts,
  qualifyCensusCore,
  serializeDeterministic,
  sha256Text,
} from '../src/lib/architecture-census';
import { captureTypecheckReceipt, captureVitestReceipt, writeReceipt } from '../src/lib/architecture-census/measure';
import { privacyViolation } from '../src/lib/architecture-census/privacy';

function main(): void {
  const repoRoot = process.cwd();
  const measure = process.argv.includes('--measure');
  const outDir = join(repoRoot, 'docs/architecture/modular-monolith/baseline');
  const snapshot = loadGitSourceSnapshot(repoRoot);
  const { core, failures } = generateCensusCore(snapshot);
  if (failures.length > 0) {
    const grouped = new Map<string, number>();
    for (const failure of failures) {
      grouped.set(failure.code, (grouped.get(failure.code) ?? 0) + 1);
    }
    console.error('qualification failures', Object.fromEntries(grouped));
    console.error(failures.slice(0, 20));
  }
  qualifyCensusCore(core, failures);
  mkdirSync(outDir, { recursive: true });
  const serialized = serializeDeterministic(core);
  const censusCoreHash = sha256Text(serialized);
  writeFileSync(join(outDir, 'census-core.json'), serialized);
  writeFileSync(join(outDir, 'census-core.sha256'), `${censusCoreHash}\n`);

  const receipts = [];
  if (measure) {
    const receiptDir = join(outDir, 'receipts');
    mkdirSync(receiptDir, { recursive: true });
    const typecheck = captureTypecheckReceipt(repoRoot, core.captureIdentity.sourceCommit, core.captureIdentity.sourceTree);
    const vitest = captureVitestReceipt(repoRoot, core.captureIdentity.sourceCommit, core.captureIdentity.sourceTree);
    receipts.push(typecheck, vitest);
    writeReceipt(join(receiptDir, `${typecheck.receiptId}.json`), typecheck);
    writeReceipt(join(receiptDir, `${vitest.receiptId}.json`), vitest);
    writeFileSync(join(outDir, 'receipts.json'), serializeDeterministic(receipts));
    writeFileSync(join(outDir, 'projection-from-receipts.json'), projectWithReceipts(censusCoreHash, receipts));
  }

  const receiptIds = receipts.map((item) => item.receiptId).sort();
  const projections = projectAll(core, censusCoreHash, receiptIds);
  for (const [name, content] of Object.entries(projections)) {
    writeFileSync(join(outDir, name), content.replace(/\n+$/u, '\n'));
  }

  const written = [
    join(outDir, 'census-core.json'),
    join(outDir, 'census-core.sha256'),
    join(outDir, 'receipts.json'),
    join(outDir, 'projection-from-receipts.json'),
    ...Object.keys(projections).map((name) => join(outDir, name)),
    ...receipts.map((item) => join(outDir, 'receipts', `${item.receiptId}.json`)),
  ];
  for (const path of written) {
    try {
      const violation = privacyViolation(readFileSync(path, 'utf8'));
      if (violation) {
        throw new Error(`${violation}:${path}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
  }
  console.log(`wrote ${core.observations.length} observations to ${outDir}`);
}

main();
