#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  POST_CONVERGENCE_DETAIL_DIR,
  POST_CONVERGENCE_OUTPUT_DIR,
  captureDriftFailures,
  generateCensusCore,
  loadGitSourceSnapshot,
  predecessorOverwriteFailures,
  projectAll,
  projectWithReceipts,
  qualifyCensusCore,
  qualifyPostConvergence,
  serializeDeterministic,
  sha256Text,
  successorPreconditionFailures,
  successorWriteGate,
  verifySuccessorArtifacts,
} from '../src/lib/architecture-census';
import {
  generatePostConvergenceSuccessor,
  loadChangeFrequencyCounts,
  loadSuccessorPredecessors,
  loadTrackedBlobIndex,
} from '../src/lib/architecture-census/post-convergence';
import { captureTypecheckReceipt, captureVitestReceipt, writeReceipt } from '../src/lib/architecture-census/measure';
import { privacyViolation } from '../src/lib/architecture-census/privacy';

function runBaseline(repoRoot: string, measure: boolean): void {
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

function git(repoRoot: string, args: readonly string[]): string {
  return execFileSync('git', [...args], { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function readArtifactLocator(repoRoot: string, locator: string): string {
  const resolved = locator.includes('/')
    ? join(repoRoot, locator)
    : join(repoRoot, POST_CONVERGENCE_OUTPUT_DIR, locator);
  return readFileSync(resolved, 'utf8');
}

function runPostConvergence(repoRoot: string): void {
  let originCommit: string;
  try {
    originCommit = git(repoRoot, ['rev-parse', 'origin/integration']);
  } catch {
    throw new Error('origin-integration-unresolvable');
  }
  if (!/^[a-f0-9]{40}$/u.test(originCommit)) {
    throw new Error(`origin-integration-unresolvable:${originCommit}`);
  }
  const snapshot = loadGitSourceSnapshot(repoRoot);
  const precondition = successorPreconditionFailures({
    originIntegrationCommit: originCommit,
    headCommit: snapshot.identity.sourceCommit,
    snapshot,
  });
  if (precondition.length > 0) {
    throw new Error(`${precondition[0]!.code}:${precondition[0]!.identity} (+${precondition.length - 1} more)`);
  }
  const predecessors = loadSuccessorPredecessors(repoRoot);
  const beforeWrites = {
    baselineCensusSha256: sha256Text(readFileSync(join(repoRoot, 'docs/architecture/modular-monolith/baseline/census-core.json'), 'utf8')),
    deltaSha256: sha256Text(readFileSync(join(repoRoot, 'docs/architecture/modular-monolith/current-head/delta.json'), 'utf8')),
  };

  const typecheck = captureTypecheckReceipt(repoRoot, snapshot.identity.sourceCommit, snapshot.identity.sourceTree);
  const vitest = captureVitestReceipt(repoRoot, snapshot.identity.sourceCommit, snapshot.identity.sourceTree);
  const receipts = [typecheck, vitest];

  const blobIndex = loadTrackedBlobIndex(repoRoot);
  const changeCounts = loadChangeFrequencyCounts(repoRoot);
  const generated = generatePostConvergenceSuccessor({
    snapshot,
    originIntegrationCommit: originCommit,
    predecessors,
    receipts,
    blobIndex,
    changeCounts,
  });
  const after = loadGitSourceSnapshot(repoRoot);
  const failures = [
    ...generated.failures,
    ...captureDriftFailures(snapshot, after),
  ];
  const { pack, files, detail } = generated;
  const porcelain = git(repoRoot, ['status', '--porcelain']);
  const commit = git(repoRoot, ['rev-parse', 'HEAD']);
  const tree = git(repoRoot, ['rev-parse', 'HEAD^{tree}']);
  failures.push(...successorWriteGate(pack.captureIdentity, originCommit, porcelain, commit, tree));
  qualifyPostConvergence(pack, failures);

  for (const artifact of detail) {
    const target = join(repoRoot, artifact.logicalLocator);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, artifact.content);
  }
  const outDir = join(repoRoot, POST_CONVERGENCE_OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(outDir, name), content.endsWith('\n') ? content : `${content}\n`);
  }

  const postFailures = [
    ...verifySuccessorArtifacts(pack, (locator) => readArtifactLocator(repoRoot, locator)),
    ...predecessorOverwriteFailures(beforeWrites, {
      baselineCensusSha256: sha256Text(readFileSync(join(repoRoot, 'docs/architecture/modular-monolith/baseline/census-core.json'), 'utf8')),
      deltaSha256: sha256Text(readFileSync(join(repoRoot, 'docs/architecture/modular-monolith/current-head/delta.json'), 'utf8')),
    }),
  ];
  qualifyPostConvergence(pack, postFailures);
  console.log(
    `wrote post-convergence successor ${pack.successorCaptureId} source=${pack.captureIdentity.sourceCommit} `
    + `status=${pack.status} committedFiles=6 detailArtifacts=${detail.length} receipts=${receipts.length} `
    + `packageDigest=${pack.packageDigest} detailDir=${POST_CONVERGENCE_DETAIL_DIR}/${pack.successorCaptureId}`,
  );
}

function main(): void {
  const repoRoot = process.cwd();
  if (process.argv.includes('--post-convergence')) {
    runPostConvergence(repoRoot);
    return;
  }
  runBaseline(repoRoot, process.argv.includes('--measure'));
}

main();
