#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { REQUIRED_BASELINE } from '../src/lib/architecture-charter';
import {
  CURRENT_HEAD_OUTPUT_DIR,
  captureDriftFailures,
  currentHeadPackageHash,
  generateCurrentHeadDelta,
  loadGitSourceSnapshot,
  qualifyCurrentHeadDelta,
  sha256Text,
} from '../src/lib/architecture-census';
import { privacyViolation } from '../src/lib/architecture-census/privacy';
import type { CurrentHeadPredecessor } from '../src/lib/architecture-census/current-head-delta';

function loadPredecessor(repoRoot: string): CurrentHeadPredecessor {
  const baselineDir = join(repoRoot, 'docs/architecture/modular-monolith/baseline');
  const censusText = readFileSync(join(baselineDir, 'census-core.json'), 'utf8');
  const censusHash = sha256Text(censusText).trim();
  const hashFile = readFileSync(join(baselineDir, 'census-core.sha256'), 'utf8').trim();
  if (censusHash !== hashFile) {
    throw new Error(`predecessor-hash-file-mismatch:${hashFile}`);
  }
  if (censusHash !== REQUIRED_BASELINE.censusCoreSha256) {
    throw new Error(`predecessor-rewritten:${censusHash}`);
  }
  const parsed = JSON.parse(censusText) as {
    schemaVersion?: string;
    captureIdentity?: { sourceCommit?: string; sourceTree?: string };
  };
  if (parsed.captureIdentity?.sourceCommit !== REQUIRED_BASELINE.sourceCommit
    || parsed.captureIdentity?.sourceTree !== REQUIRED_BASELINE.sourceTree
    || parsed.schemaVersion !== REQUIRED_BASELINE.schemaVersion) {
    throw new Error(`predecessor-identity-mismatch:${parsed.captureIdentity?.sourceCommit ?? 'missing'}`);
  }
  return REQUIRED_BASELINE;
}

function main(): void {
  const repoRoot = process.cwd();
  const snapshot = loadGitSourceSnapshot(repoRoot);
  const predecessor = loadPredecessor(repoRoot);
  const generated = generateCurrentHeadDelta(snapshot, predecessor);
  const after = loadGitSourceSnapshot(repoRoot);
  const failures = [...generated.failures, ...captureDriftFailures(snapshot, after)];
  qualifyCurrentHeadDelta(generated.pack, failures);
  const { pack, files } = generated;
  const outDir = join(repoRoot, CURRENT_HEAD_OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const violation = privacyViolation(content);
    if (violation) throw new Error(`${violation}:${name}`);
    writeFileSync(join(outDir, name), content.endsWith('\n') ? content : `${content}\n`);
  }
  console.log(`wrote current-head delta ${pack.captureIdentity.sourceCommit} records=${pack.records.length} hash=${currentHeadPackageHash(files)}`);
}

main();
