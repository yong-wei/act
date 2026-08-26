#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { MicroTutoringCoverageAuditReport } from '@/features/assessment/micro-tutoring-coverage-audit';
import {
  buildMicroTutoringProductionQualificationReceipt,
  evaluateMicroTutoringProductionActivation,
  type MicroTutoringQualificationTestProof,
  type MicroTutoringRevisionBoundDigest,
} from '@/features/assessment/micro-tutoring-production-qualification';

const GOVERNANCE_DIR = 'course-content/runtime/resource-governance';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), '.reports/micro-tutoring-qualification');
const V1_ARTIFACT_PATHS = [
  `${GOVERNANCE_DIR}/adaptive-assessment-item-catalog-items.jsonl`,
  `${GOVERNANCE_DIR}/assessment-item-semantic-review-snapshots.jsonl`,
  `${GOVERNANCE_DIR}/micro-tutoring-practice-baseline.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-option-attributions.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-goal-node-catalog.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-resource-projection.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-validation-registry.json`,
] as const;
const V2_ARTIFACT_PATHS = [
  `${GOVERNANCE_DIR}/adaptive-assessment-item-catalog-items.jsonl`,
  `${GOVERNANCE_DIR}/assessment-item-semantic-review-snapshots.jsonl`,
  `${GOVERNANCE_DIR}/micro-tutoring-assessment-baseline-v2.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-option-attributions-v2.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-goal-node-catalog.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-resource-projection-v2.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-validation-registry-v2.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-validation-purpose-reviews-v1.jsonl`,
] as const;

function git(args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`微辅导资格无法执行 Git ${args.join(' ')}：${result.stderr.trim()}`);
  }
  return result.stdout;
}

function parseBoundDigest(raw: string | undefined): MicroTutoringRevisionBoundDigest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MicroTutoringRevisionBoundDigest>;
    if (typeof parsed.sourceRevision === 'string' && typeof parsed.digest === 'string') {
      return { sourceRevision: parsed.sourceRevision, digest: parsed.digest };
    }
  } catch {
    return null;
  }
  return null;
}

function parseTestProofs(raw: string | undefined): MicroTutoringQualificationTestProof[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const proof = entry as Partial<MicroTutoringQualificationTestProof>;
      if (
        typeof proof.name === 'string' &&
        typeof proof.scope === 'string' &&
        typeof proof.sourceRevision === 'string' &&
        (proof.status === 'passed' || proof.status === 'failed' || proof.status === 'skipped')
      ) {
        return [{
          name: proof.name,
          status: proof.status,
          scope: proof.scope,
          sourceRevision: proof.sourceRevision,
        }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function parseArgs(args: string[]): { outputDir: string; offline: boolean; profile: 'v1' | 'v2' } {
  const outputIndex = args.indexOf('--output-dir');
  const profileIndex = args.indexOf('--profile');
  if (outputIndex >= 0 && !args[outputIndex + 1]) {
    throw new Error('--output-dir requires a directory');
  }
  const profileArg = profileIndex >= 0 ? args[profileIndex + 1] : 'v1';
  if (profileArg !== 'v1' && profileArg !== 'v2') {
    throw new Error('--profile must be v1 or v2');
  }
  return {
    outputDir: outputIndex >= 0 ? path.resolve(args[outputIndex + 1]!) : DEFAULT_OUTPUT_DIR,
    offline: !args.includes('--online'),
    profile: profileArg,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const coverageDir = path.join(options.outputDir, 'coverage');
  const coverageArgs = [
    path.join(process.cwd(), 'scripts/data-governance/check-micro-tutoring-coverage.ts'),
    ...(options.offline ? ['--offline'] : []),
    '--profile',
    options.profile,
    '--strict',
    '--output-dir',
    coverageDir,
  ];
  const coverage = spawnSync(process.execPath, [path.join(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), ...coverageArgs], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (coverage.status !== 0 && coverage.status !== 1) {
    throw new Error(`微辅导覆盖审计无法执行：${coverage.stderr || coverage.stdout}`);
  }
  const report = JSON.parse(
    await readFile(path.join(coverageDir, 'micro-tutoring-coverage.json'), 'utf8'),
  ) as MicroTutoringCoverageAuditReport;
  const sourceRevision = git(['rev-parse', '--verify', 'HEAD']).trim();
  const artifactDigests = (options.profile === 'v2' ? V2_ARTIFACT_PATHS : V1_ARTIFACT_PATHS).map((filePath) => ({
    path: filePath,
    sha256: `sha256:${createHash('sha256').update(git(['show', `${sourceRevision}:${filePath}`])).digest('hex')}`,
  }));
  const extraTests = parseTestProofs(process.env.MICRO_TUTORING_QUALIFICATION_TEST_PROOFS);
  const tests = [
    {
      name: options.profile === 'v2' ? 'verify:micro-tutoring-coverage:v2' : 'verify:micro-tutoring-coverage',
      status: coverage.status === 0 ? 'passed' as const : 'failed' as const,
      scope: options.offline ? 'offline-git-content' : 'online-git-db',
      sourceRevision,
    },
    ...extraTests.filter((test) =>
      test.name !== 'verify:micro-tutoring-coverage' && test.name !== 'verify:micro-tutoring-coverage:v2'),
  ];
  const built = buildMicroTutoringProductionQualificationReceipt({
    report,
    artifactDigests,
    tests,
    coverageProfile: options.profile,
    browserEvidence: parseBoundDigest(process.env.MICRO_TUTORING_QUALIFICATION_BROWSER_EVIDENCE_PROOF),
    ociImage: parseBoundDigest(process.env.MICRO_TUTORING_QUALIFICATION_OCI_PROOF),
  });
  await mkdir(options.outputDir, { recursive: true });
  const receiptPath = path.join(
    options.outputDir,
    options.profile === 'v2'
      ? 'micro-tutoring-v2-candidate-receipt.json'
      : 'micro-tutoring-candidate-receipt.json',
  );
  if (!built.receipt) {
    await unlink(receiptPath).catch(() => undefined);
    console.error(JSON.stringify({ issues: built.issues }, null, 2));
    process.exitCode = 1;
    return;
  }
  const activation = evaluateMicroTutoringProductionActivation({
    receipt: built.receipt,
    authorized: false,
  });
  if (
    !built.receipt.strictlyComplete ||
    !built.receipt.gitContentComplete ||
    activation.status !== 'candidate-only'
  ) {
    await unlink(receiptPath).catch(() => undefined);
    console.error(JSON.stringify({
      issues: ['STRICT_COVERAGE_INCOMPLETE'],
      activation: activation.status,
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  await writeFile(receiptPath, `${JSON.stringify(built.receipt, null, 2)}\n`);
  console.log(JSON.stringify({
    receiptPath,
    receiptDigest: built.receipt.receiptDigest,
    gitContentComplete: built.receipt.gitContentComplete,
    strictlyComplete: built.receipt.strictlyComplete,
    sourceRevision: built.receipt.sourceRevision,
    governedProjectionRevision: built.receipt.governedProjectionRevision,
    browserEvidence: built.receipt.browserEvidence,
    ociImage: built.receipt.ociImage,
    activation: activation.status,
    productionUnchanged: activation.productionUnchanged,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
