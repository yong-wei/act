#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  verifyMaterializedSnapshot,
  type AuthorityEngineeringBody,
  type AuthoritySnapshotManifest,
} from '../../src/lib/authoritative-knowledge/authority-snapshot';
import {
  activationCanonicalJson,
  activateConsumerActivation,
  readCurrentConsumerActivationPointer,
  resolveConsumerActivationStorePaths,
  rollbackConsumerActivation,
  stageConsumerActivation,
  type ConsumerActivationManifest,
  type StagedActivationArtifactSet,
} from '../../src/lib/versioned-knowledge-activation';

const COMMIT = /^[a-f0-9]{40}$/u;
const DEFAULT_ROOTS = [
  'course-content/authoring/knowledge/authority',
  'course-content/runtime/knowledge/projection',
  'course-content/runtime/knowledge/consumer-activation',
  'course-content/runtime/knowledge/legacy-retirement',
] as const;

export const CUTOVER_CONSUMER_STAGING_PROTOCOL =
  'actkg-to-act-cutover-consumer-staging/1' as const;

interface PointerObservation {
  relativePath: string;
  state: 'ABSENT' | 'PRESENT';
  sha256: string | null;
}

interface ProjectionCandidateEvidence {
  inventoryDigest: string;
  migrationReportDigest: string;
  worklistDigest: string;
  packageReportDigest: string;
  packageCount: number;
  resourceCount: number;
  boundCount: number;
  explicitNoneCount: number;
  reviewRequiredCount: number;
  readyPackageCount: number;
  blockedPackageCount: number;
}

function fail(message: string): never {
  throw new Error(`ActKG → ACT consumer staging rejected: ${message}`);
}

function nonEmpty(value: string | undefined, label: string): string {
  if (!value || value.trim().length === 0) fail(`${label} must be a non-empty string`);
  return value.trim();
}

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function relative(repoRoot: string, target: string): string {
  const result = path.relative(path.resolve(repoRoot), path.resolve(target));
  return result.length === 0 ? '.' : result.split(path.sep).join('/');
}

function readJson(filePath: string): Record<string, unknown> {
  try {
    const value = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(`JSON object required: ${relative(process.cwd(), filePath)}`);
    }
    return value as Record<string, unknown>;
  } catch (error) {
    fail(`cannot read JSON ${relative(process.cwd(), filePath)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function pointerObservations(repoRoot: string): PointerObservation[] {
  return DEFAULT_ROOTS.map((root) => {
    const relativePath = `${root}/current.json`;
    const filePath = path.join(repoRoot, relativePath);
    if (!existsSync(filePath)) {
      return { relativePath, state: 'ABSENT', sha256: null };
    }
    return {
      relativePath,
      state: 'PRESENT',
      sha256: sha256(readFileSync(filePath)),
    };
  });
}

function samePointers(left: readonly PointerObservation[], right: readonly PointerObservation[]): boolean {
  return activationCanonicalJson(left) === activationCanonicalJson(right);
}

export function assertNonDefaultStagingRoot(repoRoot: string, outputRoot: string): void {
  const resolved = path.resolve(outputRoot);
  if (path.basename(resolved) === 'current.json') {
    fail('outputRoot cannot be a current.json path');
  }
  for (const defaultRoot of DEFAULT_ROOTS) {
    const resolvedDefault = path.resolve(repoRoot, defaultRoot);
    if (resolved === resolvedDefault || resolved.startsWith(`${resolvedDefault}${path.sep}`)) {
      fail('outputRoot must not resolve inside a default Authority, Projection, activation, or retirement root');
    }
  }
}

/**
 * A candidate without an active default baseline cannot truthfully claim
 * consumer readiness: neither shadow comparison nor route smoke can run.
 */
export function blockConsumersWithoutDefaultBaseline(
  artifacts: StagedActivationArtifactSet,
): StagedActivationArtifactSet {
  const unavailable = {
    ok: false,
    reasons: [
      'shadow-baseline-missing',
      'rollback-baseline-missing',
      'route-smoke-unavailable-without-default-activation',
    ],
  };
  return {
    ...artifacts,
    routeSmoke: {
      ...artifacts.routeSmoke,
      'engineering-graph': unavailable,
      'engineering-rag': unavailable,
    },
  };
}

function requiredFileHash(root: string, relativePath: string): { path: string; hash: string } {
  const filePath = path.join(root, relativePath);
  if (!existsSync(filePath)) fail(`required staged artifact missing: ${relative(process.cwd(), filePath)}`);
  return { path: filePath, hash: sha256(readFileSync(filePath)) };
}

function loadAuthority(input: {
  manifestPath: string;
  captureRevision: string;
}): {
  manifest: AuthoritySnapshotManifest;
  artifactHashes: Record<string, string>;
  artifactPaths: Record<string, string>;
} {
  const manifest = readJson(input.manifestPath) as unknown as AuthoritySnapshotManifest;
  const root = path.dirname(input.manifestPath);
  const engineeringPath = path.join(root, 'engineering.json');
  const engineering = readJson(engineeringPath) as unknown as AuthorityEngineeringBody;
  try {
    verifyMaterializedSnapshot({ manifest, engineering });
  } catch (error) {
    fail(`Authority Snapshot integrity validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (manifest.lifecycle !== 'staged') fail('Authority Snapshot must remain staged');
  if (manifest.captureRevision !== input.captureRevision) {
    fail(`Authority captureRevision mismatch: ${manifest.captureRevision ?? 'null'}`);
  }
  const manifestArtifact = requiredFileHash(root, 'manifest.json');
  const engineeringArtifact = requiredFileHash(root, 'engineering.json');
  return {
    manifest,
    artifactHashes: {
      'manifest.json': manifestArtifact.hash,
      'engineering.json': engineeringArtifact.hash,
    },
    artifactPaths: {
      'manifest.json': manifestArtifact.path,
      'engineering.json': engineeringArtifact.path,
    },
  };
}

function numberField(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`${label}.${key} must be a non-negative integer`);
  }
  return value;
}

function stringField(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) fail(`${label}.${key} must be a non-empty string`);
  return value;
}

function loadProjectionCandidate(input: {
  root: string;
  captureRevision: string;
}): ProjectionCandidateEvidence {
  const inventoryPath = path.join(input.root, 'inventory.json');
  const migrationPath = path.join(input.root, 'migration-status.json');
  const worklistPath = path.join(input.root, 'worklist.json');
  const reportsPath = path.join(input.root, 'package-reports.json');
  const inventory = readJson(inventoryPath);
  const migration = readJson(migrationPath);
  const worklist = readJson(worklistPath);
  const reports = readJson(reportsPath);
  if (stringField(inventory, 'authoringRevision', 'inventory') !== input.captureRevision) {
    fail('projection inventory capture revision mismatch');
  }
  if (stringField(migration, 'authoringRevision', 'migration') !== input.captureRevision) {
    fail('projection migration capture revision mismatch');
  }
  if (stringField(worklist, 'authoringRevision', 'worklist') !== input.captureRevision) {
    fail('projection worklist capture revision mismatch');
  }
  const inventoryDigest = stringField(inventory, 'inventoryDigest', 'inventory');
  if (stringField(migration, 'inventoryDigest', 'migration') !== inventoryDigest) {
    fail('projection migration inventory digest mismatch');
  }
  if (stringField(worklist, 'inventoryDigest', 'worklist') !== inventoryDigest) {
    fail('projection worklist inventory digest mismatch');
  }
  const summary = migration.summary;
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) fail('migration.summary missing');
  const migrationSummary = summary as Record<string, unknown>;
  const reportRows = reports.reports;
  if (!Array.isArray(reportRows)) fail('package-reports.reports must be an array');
  const packageCount = numberField(inventory, 'packageCount', 'inventory');
  const resourceCount = numberField(inventory, 'resourceCount', 'inventory');
  if (reportRows.length !== packageCount) fail('projection package report count mismatch');
  const worklistRows = worklist.items;
  if (!Array.isArray(worklistRows)) fail('worklist.items must be an array');
  const reviewRequiredCount = numberField(migrationSummary, 'reviewRequiredCount', 'migration.summary');
  if (worklistRows.length !== reviewRequiredCount || numberField(worklist, 'itemCount', 'worklist') !== reviewRequiredCount) {
    fail('projection worklist does not close REVIEW_REQUIRED denominator');
  }
  const packageIds = new Set<string>();
  let readyPackageCount = 0;
  for (const row of reportRows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail('invalid package report row');
    const report = row as Record<string, unknown>;
    const packageId = stringField(report, 'packageId', 'package report');
    if (packageIds.has(packageId)) fail(`duplicate package report: ${packageId}`);
    packageIds.add(packageId);
    if (report.ready === true) readyPackageCount += 1;
    if (!report.candidate || typeof report.candidate !== 'object' || Array.isArray(report.candidate)) {
      fail(`package report lacks staged candidate: ${packageId}`);
    }
  }
  return {
    inventoryDigest,
    migrationReportDigest: sha256(readFileSync(migrationPath)),
    worklistDigest: sha256(readFileSync(worklistPath)),
    packageReportDigest: sha256(readFileSync(reportsPath)),
    packageCount,
    resourceCount,
    boundCount: numberField(migrationSummary, 'boundCount', 'migration.summary'),
    explicitNoneCount: numberField(migrationSummary, 'explicitNoneCount', 'migration.summary'),
    reviewRequiredCount,
    readyPackageCount,
    blockedPackageCount: packageCount - readyPackageCount,
  };
}

function consumerState(manifest: ConsumerActivationManifest): Record<string, {
  status: string;
  reasons: string[];
}> {
  return Object.fromEntries(manifest.consumers.map((consumer) => [consumer.consumerId, {
    status: consumer.status,
    reasons: consumer.reasons,
  }]));
}

async function writeCanonical(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${activationCanonicalJson(value)}\n`, 'utf8');
}

function runRollbackExercise(input: {
  root: string;
  artifacts: StagedActivationArtifactSet;
  stagedAt: string;
  authoritySnapshotHash: string;
}): Record<string, unknown> {
  const paths = resolveConsumerActivationStorePaths(input.root);
  const priorId = `exercise-prior-${input.authoritySnapshotHash.slice(0, 20)}`;
  const candidateId = `exercise-candidate-${input.authoritySnapshotHash.slice(0, 20)}`;
  const rollbackReceiptId = `exercise-rollback-${input.authoritySnapshotHash.slice(0, 20)}`;
  const existing = readCurrentConsumerActivationPointer(paths);
  if (existing) {
    if (existing.activationId !== priorId) fail('rollback exercise current pointer does not match its verified prior state');
    const receiptPath = path.join(paths.rollbacksDir, `${rollbackReceiptId}.json`);
    if (!existsSync(receiptPath)) fail('rollback exercise receipt is missing');
    const receipt = readJson(receiptPath);
    if (
      receipt.status !== 'rolled-back'
      || receipt.toActivationId !== priorId
      || receipt.fromActivationId !== candidateId
    ) {
      fail('rollback exercise receipt does not prove the expected staged rollback');
    }
    return {
      status: 'verified-previous-rollback',
      priorActivationId: priorId,
      candidateActivationId: candidateId,
      rollbackReceiptId,
    };
  }
  const prior = stageConsumerActivation(paths, {
    artifacts: input.artifacts,
    activationId: priorId,
    stagedAt: input.stagedAt,
  });
  const first = activateConsumerActivation(paths, {
    activationId: prior.activationId,
    activationReceiptId: `exercise-activate-prior-${input.authoritySnapshotHash.slice(0, 20)}`,
    activatedAt: input.stagedAt,
  });
  if (first.status !== 'activated') fail(`rollback exercise first activation failed: ${first.receipt.reasons.join(',')}`);
  const candidate = stageConsumerActivation(paths, {
    artifacts: input.artifacts,
    activationId: candidateId,
    stagedAt: input.stagedAt,
    priorActivationId: prior.activationId,
    priorActivationHash: prior.activationHash,
  });
  const second = activateConsumerActivation(paths, {
    activationId: candidate.activationId,
    activationReceiptId: `exercise-activate-candidate-${input.authoritySnapshotHash.slice(0, 20)}`,
    activatedAt: input.stagedAt,
  });
  if (second.status !== 'activated') fail(`rollback exercise candidate activation failed: ${second.receipt.reasons.join(',')}`);
  const rollback = rollbackConsumerActivation(paths, {
    toActivationId: prior.activationId,
    toActivationHash: prior.activationHash,
    rollbackReceiptId,
    rolledBackAt: input.stagedAt,
  });
  if (rollback.status !== 'rolled-back' || rollback.pointer?.activationId !== prior.activationId) {
    fail(`rollback exercise failed: ${rollback.receipt.reasons.join(',')}`);
  }
  return {
    status: 'rolled-back',
    priorActivationId: prior.activationId,
    candidateActivationId: candidate.activationId,
    rollbackReceiptId,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const option = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index < 0 ? undefined : argv[index + 1];
  };
  const repoRoot = path.resolve(nonEmpty(option('--repo-root'), '--repo-root'));
  const outputRoot = path.resolve(nonEmpty(option('--output-root'), '--output-root'));
  const authorityManifestPath = path.resolve(nonEmpty(option('--authority-manifest'), '--authority-manifest'));
  const projectionRoot = path.resolve(nonEmpty(option('--projection-root'), '--projection-root'));
  const captureRevision = nonEmpty(option('--capture-revision'), '--capture-revision');
  const stagedAt = nonEmpty(option('--staged-at'), '--staged-at');
  if (!COMMIT.test(captureRevision)) fail('captureRevision must be a 40-character Git SHA');
  if (Number.isNaN(Date.parse(stagedAt))) fail('stagedAt must be an ISO timestamp');
  assertNonDefaultStagingRoot(repoRoot, outputRoot);
  const beforePointers = pointerObservations(repoRoot);
  const authority = loadAuthority({ manifestPath: authorityManifestPath, captureRevision });
  const projection = loadProjectionCandidate({ root: projectionRoot, captureRevision });
  const rollbackExerciseArtifacts: StagedActivationArtifactSet = {
    captureRevision,
    authority: {
      present: true,
      releaseId: authority.manifest.releaseId,
      snapshotId: authority.manifest.snapshotId,
      snapshotHash: authority.manifest.snapshotHash,
      captureRevision: authority.manifest.captureRevision,
      artifactHashes: authority.artifactHashes,
      artifactPaths: authority.artifactPaths,
    },
    projection: null,
  };
  const artifacts = blockConsumersWithoutDefaultBaseline(rollbackExerciseArtifacts);
  const stagingPaths = resolveConsumerActivationStorePaths(path.join(outputRoot, 'consumer-activation'));
  const staged = stageConsumerActivation(stagingPaths, { artifacts, stagedAt });
  if (existsSync(stagingPaths.currentPointer)) fail('consumer staging unexpectedly wrote current.json');
  const rollbackExercise = runRollbackExercise({
    root: path.join(outputRoot, 'rollback-exercise'),
    artifacts: rollbackExerciseArtifacts,
    stagedAt,
    authoritySnapshotHash: authority.manifest.snapshotHash,
  });
  const afterPointers = pointerObservations(repoRoot);
  if (!samePointers(beforePointers, afterPointers)) {
    fail('a default Authority, Projection, activation, or retirement pointer changed');
  }
  const assessment = {
    contract: 'act-actkg-cutover-consumer-staging-assessment/v1',
    protocol: CUTOVER_CONSUMER_STAGING_PROTOCOL,
    captureRevision,
    stagedAt,
    authority: {
      releaseId: authority.manifest.releaseId,
      snapshotId: authority.manifest.snapshotId,
      snapshotHash: authority.manifest.snapshotHash,
      lifecycle: authority.manifest.lifecycle,
      artifactHashes: authority.artifactHashes,
    },
    projection: {
      candidateRoot: relative(repoRoot, projectionRoot),
      ...projection,
      globalProjectionAvailable: false,
      reason: 'all teaching packages remain non-default review candidates; no activated global Teaching Projection exists',
    },
    activation: {
      releaseDir: relative(repoRoot, staged.releaseDir),
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      stageReceiptId: staged.stageReceipt.receiptId,
      consumers: consumerState(staged.manifest),
    },
    shadow: {
      status: 'BLOCKED',
      reason: 'default consumer-activation current.json is absent, so no active baseline exists for a truthful shadow comparison',
      writesLearningFact: false,
      writesTeachingDecision: false,
      writesUpstreamRelation: false,
    },
    rollback: {
      defaultPointer: 'UNCHANGED_ABSENT',
      stagedStoreExercise: rollbackExercise,
      limitation: 'the exercised predecessor is a non-default local staging record, not a production activation baseline',
    },
    routeSmoke: {
      status: 'BLOCKED',
      reason: 'no active default Authority/Projection/activation combination exists; route smoke cannot truthfully claim candidate activation',
    },
    defaultPointers: { before: beforePointers, after: afterPointers, unchanged: true },
    switchEligible: false,
    blockers: [
      `teaching-review-required:${projection.reviewRequiredCount}`,
      `teaching-packages-not-ready:${projection.blockedPackageCount}`,
      'global-teaching-projection-missing',
      'default-shadow-baseline-missing',
      'route-smoke-not-runnable-without-activation',
    ],
  };
  await writeCanonical(path.join(outputRoot, 'consumer-staging-assessment.json'), assessment);
  const readinessReport = {
    contract: 'act-actkg-cutover-pre-switch-readiness/v1',
    status: 'BLOCKED',
    captureRevision,
    sourceRelease: {
      releaseSetId: authority.manifest.releaseSetId,
      releaseId: authority.manifest.releaseId,
      releaseHash: authority.manifest.releaseHash,
      bundleDigest: authority.manifest.bundleDigest,
      sourceDatasetHash: authority.manifest.sourceDatasetHash,
      predecessorReleaseId: authority.manifest.predecessorReleaseId,
    },
    authority: {
      snapshotId: authority.manifest.snapshotId,
      snapshotHash: authority.manifest.snapshotHash,
      lifecycle: authority.manifest.lifecycle,
      manifest: relative(repoRoot, authorityManifestPath),
      artifactHashes: authority.artifactHashes,
    },
    teachingProjection: {
      candidateRoot: relative(repoRoot, projectionRoot),
      inventoryDigest: projection.inventoryDigest,
      packageCount: projection.packageCount,
      resourceCount: projection.resourceCount,
      boundCount: projection.boundCount,
      explicitNoneCount: projection.explicitNoneCount,
      reviewRequiredCount: projection.reviewRequiredCount,
      readyPackageCount: projection.readyPackageCount,
      blockedPackageCount: projection.blockedPackageCount,
      globalProjection: 'ABSENT',
      reason: 'no package candidate passed its required-resource gate, so no global Teaching Projection may be activated',
    },
    consumers: consumerState(staged.manifest),
    evidence: {
      defaultPointers: assessment.defaultPointers,
      shadow: assessment.shadow,
      routeSmoke: assessment.routeSmoke,
      rollback: assessment.rollback,
    },
    historicalCourseCoverage: {
      batchCount: 34,
      deferCount: 4880,
      includedInReleaseDeltaDenominator: false,
      activationBlockerByItself: false,
    },
    requestAtomicPointerSwitchOnlyWhen: [
      'all active course REVIEW_REQUIRED worklist items are resolved through actual ACT-owned evidence',
      'a complete global Teaching Projection passes every affected package gate',
      'every teaching consumer has acceptable staged readiness, shadow, route-smoke, and rollback evidence',
      'a separately authorized atomic pointer-switch request is approved',
    ],
    currentBlockers: assessment.blockers,
    legacyRetirement: {
      status: 'DEFERRED',
      condition: 'after an authorized pointer switch and a zero-fallback evidence window',
    },
  };
  await writeCanonical(path.join(outputRoot, 'pre-switch-readiness-report.json'), readinessReport);
  process.stdout.write(`${JSON.stringify({
    protocol: CUTOVER_CONSUMER_STAGING_PROTOCOL,
    activation: {
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      consumers: consumerState(staged.manifest),
    },
    projection: {
      reviewRequiredCount: projection.reviewRequiredCount,
      blockedPackageCount: projection.blockedPackageCount,
    },
    defaultPointersUnchanged: true,
    switchEligible: false,
  }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
