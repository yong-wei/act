#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { MicroTutoringCoverageAuditReport } from '@/features/assessment/micro-tutoring-coverage-audit';
import {
  buildMicroTutoringProductionQualificationReceipt,
  evaluateMicroTutoringProductionActivation,
} from '@/features/assessment/micro-tutoring-production-qualification';

const GOVERNANCE_DIR = 'course-content/runtime/resource-governance';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), '.reports/micro-tutoring-qualification');
const ARTIFACT_PATHS = [
  `${GOVERNANCE_DIR}/adaptive-assessment-item-catalog-items.jsonl`,
  `${GOVERNANCE_DIR}/assessment-item-semantic-review-snapshots.jsonl`,
  `${GOVERNANCE_DIR}/micro-tutoring-practice-baseline.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-option-attributions.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-goal-node-catalog.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-resource-projection.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-validation-registry.json`,
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

function parseArgs(args: string[]): { outputDir: string; offline: boolean } {
  const outputIndex = args.indexOf('--output-dir');
  if (outputIndex >= 0 && !args[outputIndex + 1]) {
    throw new Error('--output-dir requires a directory');
  }
  return {
    outputDir: outputIndex >= 0 ? path.resolve(args[outputIndex + 1]!) : DEFAULT_OUTPUT_DIR,
    offline: !args.includes('--online'),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const coverageDir = path.join(options.outputDir, 'coverage');
  const coverageArgs = [
    path.join(process.cwd(), 'scripts/data-governance/check-micro-tutoring-coverage.ts'),
    ...(options.offline ? ['--offline'] : []),
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
  const artifactDigests = ARTIFACT_PATHS.map((filePath) => ({
    path: filePath,
    sha256: `sha256:${createHash('sha256').update(git(['show', `${sourceRevision}:${filePath}`])).digest('hex')}`,
  }));
  const built = buildMicroTutoringProductionQualificationReceipt({
    report,
    artifactDigests,
    tests: [
      {
        name: 'verify:micro-tutoring-coverage',
        status: coverage.status === 0 ? 'passed' : 'failed',
        scope: options.offline ? 'offline-git-content' : 'online-git-db',
      },
    ],
    ociDigest: process.env.MICRO_TUTORING_QUALIFICATION_OCI_DIGEST?.trim() || null,
  });
  if (!built.receipt) {
    console.error(JSON.stringify({ issues: built.issues }, null, 2));
    process.exitCode = 1;
    return;
  }
  const activation = evaluateMicroTutoringProductionActivation({
    receipt: built.receipt,
    authorized: false,
  });
  await mkdir(options.outputDir, { recursive: true });
  const receiptPath = path.join(options.outputDir, 'micro-tutoring-candidate-receipt.json');
  await writeFile(receiptPath, `${JSON.stringify(built.receipt, null, 2)}\n`);
  console.log(JSON.stringify({
    receiptPath,
    receiptDigest: built.receipt.receiptDigest,
    gitContentComplete: built.receipt.gitContentComplete,
    strictlyComplete: built.receipt.strictlyComplete,
    sourceRevision: built.receipt.sourceRevision,
    activation: activation.status,
    productionUnchanged: activation.productionUnchanged,
  }, null, 2));
  if (!built.receipt.gitContentComplete || activation.status !== 'candidate-only') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
