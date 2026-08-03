/**
 * Filesystem Authority Store: staged snapshots, atomic current pointer,
 * and one-pointer rollback (#1266).
 *
 * Layout (under authorityRoot):
 *   current.json
 *   releases/<snapshotId>/manifest.json
 *   releases/<snapshotId>/engineering.json
 *   releases/<snapshotId>/stage-receipt.json
 *   activations/<activationReceiptId>.json
 *   rollbacks/<rollbackReceiptId>.json
 */

import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import {
  AUTHORITY_ACTIVATION_RECEIPT_CONTRACT,
  AUTHORITY_CURRENT_POINTER_CONTRACT,
  AUTHORITY_ROLLBACK_RECEIPT_CONTRACT,
  AUTHORITY_SNAPSHOT_CONTRACT,
  AUTHORITY_STAGE_RECEIPT_CONTRACT,
  AuthoritySnapshotError,
  authorityCanonicalJson,
  authoritySha256,
  emptyTeachingSelectorFingerprint,
  materializeAuthoritySnapshot,
  teachingSelectorsEqual,
  verifyMaterializedSnapshot,
  type AuthorityActivationReceipt,
  type AuthorityCurrentPointer,
  type AuthorityEngineeringBody,
  type AuthorityRollbackReceipt,
  type AuthoritySnapshotManifest,
  type AuthorityStageReceipt,
  type MaterializeAuthoritySnapshotInput,
  type TeachingSelectorFingerprint,
} from './authority-snapshot';

export interface AuthorityStorePaths {
  root: string;
  currentPointer: string;
  releasesDir: string;
  activationsDir: string;
  rollbacksDir: string;
}

export function resolveAuthorityStorePaths(authorityRoot: string): AuthorityStorePaths {
  return {
    root: authorityRoot,
    currentPointer: join(authorityRoot, 'current.json'),
    releasesDir: join(authorityRoot, 'releases'),
    activationsDir: join(authorityRoot, 'activations'),
    rollbacksDir: join(authorityRoot, 'rollbacks'),
  };
}

export function releaseDir(paths: AuthorityStorePaths, snapshotId: string): string {
  return join(paths.releasesDir, snapshotId);
}

/**
 * Atomic JSON write: write temp + fsync + rename. On POSIX rename is atomic
 * within the same filesystem, so readers never observe a partial pointer.
 */
export function atomicWriteFile(
  filePath: string,
  content: string,
  options: { fsync?: boolean } = {},
): void {
  const fsync = options.fsync !== false;
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(tempPath, 'w');
  try {
    writeSync(fd, content, undefined, 'utf8');
    if (fsync) fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tempPath, filePath);
  if (fsync) {
    try {
      const dirFd = openSync(dirname(filePath), 'r');
      try {
        fsyncSync(dirFd);
      } finally {
        closeSync(dirFd);
      }
    } catch {
      // Directory fsync is best-effort (not always supported).
    }
  }
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function ensureAuthorityStore(paths: AuthorityStorePaths): void {
  mkdirSync(paths.releasesDir, { recursive: true });
  mkdirSync(paths.activationsDir, { recursive: true });
  mkdirSync(paths.rollbacksDir, { recursive: true });
}

export interface StagedAuthoritySnapshotFiles {
  snapshotId: string;
  snapshotHash: string;
  manifestPath: string;
  engineeringPath: string;
  stageReceiptPath: string;
  manifest: AuthoritySnapshotManifest;
  engineering: AuthorityEngineeringBody;
  stageReceipt: AuthorityStageReceipt;
  /** True when an identical snapshot already existed (idempotent reuse). */
  reused: boolean;
}

/**
 * Stage an immutable Authority Snapshot from a validated Repository view.
 * Never mutates authority/current.json or teaching selectors.
 */
export function stageAuthoritySnapshot(
  paths: AuthorityStorePaths,
  input: MaterializeAuthoritySnapshotInput,
  options: { stagedAt?: string; receiptId?: string } = {},
): StagedAuthoritySnapshotFiles {
  ensureAuthorityStore(paths);
  let materialized;
  try {
    materialized = materializeAuthoritySnapshot(input);
  } catch (error) {
    if (error instanceof AuthoritySnapshotError) throw error;
    throw new AuthoritySnapshotError(
      'materialization-failed',
      error instanceof Error ? error.message : 'materialization failed',
    );
  }

  const { snapshotId, snapshotHash, manifest, engineering } = materialized;
  const dir = releaseDir(paths, snapshotId);
  const manifestPath = join(dir, 'manifest.json');
  const engineeringPath = join(dir, 'engineering.json');
  const stageReceiptPath = join(dir, 'stage-receipt.json');

  if (existsSync(manifestPath) && existsSync(engineeringPath)) {
    const existingManifest = readJsonFile<AuthoritySnapshotManifest>(manifestPath);
    const existingEngineering = readJsonFile<AuthorityEngineeringBody>(engineeringPath);
    verifyMaterializedSnapshot({
      manifest: existingManifest,
      engineering: existingEngineering,
    });
    if (
      existingManifest.snapshotHash !== snapshotHash
      || existingManifest.snapshotId !== snapshotId
    ) {
      throw new AuthoritySnapshotError(
        'hash-invalid',
        'existing snapshot identity conflicts with recomputed digest',
      );
    }
    const existingReceipt = existsSync(stageReceiptPath)
      ? readJsonFile<AuthorityStageReceipt>(stageReceiptPath)
      : null;
    return {
      snapshotId,
      snapshotHash,
      manifestPath,
      engineeringPath,
      stageReceiptPath,
      manifest: existingManifest,
      engineering: existingEngineering,
      stageReceipt: existingReceipt ?? buildStageReceipt({
        snapshotId,
        snapshotHash,
        releaseId: manifest.releaseId,
        releaseSetId: manifest.releaseSetId,
        stagedAt: options.stagedAt ?? new Date().toISOString(),
        receiptId: options.receiptId,
        reasons: ['idempotent-reuse'],
      }),
      reused: true,
    };
  }

  // Write into a temporary directory, then rename into place so interrupted
  // staging never exposes a partial release directory as current.
  const stagingDir = `${dir}.staging-${process.pid}-${randomUUID()}`;
  mkdirSync(stagingDir, { recursive: true });
  const stagedAt = options.stagedAt ?? new Date().toISOString();
  const stageReceipt = buildStageReceipt({
    snapshotId,
    snapshotHash,
    releaseId: manifest.releaseId,
    releaseSetId: manifest.releaseSetId,
    stagedAt,
    receiptId: options.receiptId,
    reasons: ['staged-candidate-only', 'selectors-unchanged'],
  });

  try {
    writeJsonAtomic(join(stagingDir, 'engineering.json'), engineering);
    writeJsonAtomic(join(stagingDir, 'manifest.json'), manifest);
    writeJsonAtomic(join(stagingDir, 'stage-receipt.json'), stageReceipt);
    // Validate what we wrote before publishing the directory name.
    verifyMaterializedSnapshot({
      manifest: readJsonFile(join(stagingDir, 'manifest.json')),
      engineering: readJsonFile(join(stagingDir, 'engineering.json')),
    });
    renameSync(stagingDir, dir);
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    if (error instanceof AuthoritySnapshotError) throw error;
    throw new AuthoritySnapshotError(
      'stage-write-failed',
      error instanceof Error ? error.message : 'stage write failed',
    );
  }

  return {
    snapshotId,
    snapshotHash,
    manifestPath,
    engineeringPath,
    stageReceiptPath,
    manifest,
    engineering,
    stageReceipt,
    reused: false,
  };
}

function buildStageReceipt(input: {
  snapshotId: string;
  snapshotHash: string;
  releaseId: string;
  releaseSetId: string;
  stagedAt: string;
  receiptId?: string;
  reasons: string[];
}): AuthorityStageReceipt {
  return {
    contract: AUTHORITY_STAGE_RECEIPT_CONTRACT,
    receiptId: input.receiptId ?? `stage-${input.snapshotHash.slice(0, 16)}`,
    snapshotId: input.snapshotId,
    snapshotHash: input.snapshotHash,
    releaseId: input.releaseId,
    releaseSetId: input.releaseSetId,
    stagedAt: input.stagedAt,
    status: 'staged',
    selectorsChanged: 0,
    teachingSelectorsAdvanced: false,
    engineeringAuthorityAdvanced: false,
    reasons: input.reasons,
  };
}

export interface LoadedAuthoritySnapshot {
  snapshotId: string;
  snapshotHash: string;
  manifest: AuthoritySnapshotManifest;
  engineering: AuthorityEngineeringBody;
  stageReceipt: AuthorityStageReceipt | null;
}

export function loadStagedAuthoritySnapshot(
  paths: AuthorityStorePaths,
  snapshotId: string,
): LoadedAuthoritySnapshot {
  const dir = releaseDir(paths, snapshotId);
  const manifestPath = join(dir, 'manifest.json');
  const engineeringPath = join(dir, 'engineering.json');
  if (!existsSync(manifestPath) || !existsSync(engineeringPath)) {
    throw new AuthoritySnapshotError(
      'snapshot-missing',
      `staged snapshot missing: ${snapshotId}`,
    );
  }
  const manifest = readJsonFile<AuthoritySnapshotManifest>(manifestPath);
  const engineering = readJsonFile<AuthorityEngineeringBody>(engineeringPath);
  if (manifest.snapshotId !== snapshotId) {
    throw new AuthoritySnapshotError(
      'hash-invalid',
      'directory snapshotId does not match manifest.snapshotId',
    );
  }
  verifyMaterializedSnapshot({ manifest, engineering });
  const stageReceiptPath = join(dir, 'stage-receipt.json');
  const stageReceipt = existsSync(stageReceiptPath)
    ? readJsonFile<AuthorityStageReceipt>(stageReceiptPath)
    : null;
  return {
    snapshotId,
    snapshotHash: manifest.snapshotHash,
    manifest,
    engineering,
    stageReceipt,
  };
}

export function readCurrentAuthorityPointer(
  paths: AuthorityStorePaths,
): AuthorityCurrentPointer | null {
  if (!existsSync(paths.currentPointer)) return null;
  let pointer: AuthorityCurrentPointer;
  try {
    pointer = readJsonFile<AuthorityCurrentPointer>(paths.currentPointer);
  } catch {
    throw new AuthoritySnapshotError(
      'pointer-malformed',
      'authority/current.json is malformed',
    );
  }
  if (pointer.contract !== AUTHORITY_CURRENT_POINTER_CONTRACT) {
    throw new AuthoritySnapshotError(
      'pointer-malformed',
      'authority/current.json contract mismatch',
    );
  }
  if (!pointer.snapshotId || !pointer.snapshotHash) {
    throw new AuthoritySnapshotError(
      'pointer-malformed',
      'authority/current.json missing snapshot identity',
    );
  }
  return pointer;
}

/**
 * Resolve the active Authority Snapshot via the current pointer. Fail closed
 * on missing/mismatched pointer or digest drift; never fall back to an
 * arbitrary candidate or partial directory.
 */
export function resolveActiveAuthoritySnapshot(
  paths: AuthorityStorePaths,
):
  | { status: 'available'; pointer: AuthorityCurrentPointer; snapshot: LoadedAuthoritySnapshot }
  | { status: 'unavailable'; reason: 'active-pointer-unavailable'; detail: string } {
  try {
    const pointer = readCurrentAuthorityPointer(paths);
    if (!pointer) {
      return {
        status: 'unavailable',
        reason: 'active-pointer-unavailable',
        detail: 'current pointer absent',
      };
    }
    const snapshot = loadStagedAuthoritySnapshot(paths, pointer.snapshotId);
    if (snapshot.snapshotHash !== pointer.snapshotHash) {
      return {
        status: 'unavailable',
        reason: 'active-pointer-unavailable',
        detail: 'pointer snapshotHash does not match staged manifest',
      };
    }
    if (snapshot.manifest.snapshotHash !== pointer.snapshotHash) {
      return {
        status: 'unavailable',
        reason: 'active-pointer-unavailable',
        detail: 'manifest digest mismatch',
      };
    }
    return { status: 'available', pointer, snapshot };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: 'active-pointer-unavailable',
      detail: error instanceof Error ? error.message : 'active pointer unavailable',
    };
  }
}

export interface ActivateAuthoritySnapshotInput {
  snapshotId: string;
  /** Caller-observed teaching selectors; must be unchanged after activation. */
  teachingSelectors?: TeachingSelectorFingerprint;
  activatedAt?: string;
  activationReceiptId?: string;
}

export interface ActivateAuthoritySnapshotResult {
  status: 'activated' | 'failed';
  receipt: AuthorityActivationReceipt;
  pointer: AuthorityCurrentPointer | null;
}

/**
 * Explicit activation transaction: validates the staged snapshot, copies the
 * prior pointer to a rollback artifact, then atomically replaces current.json.
 * Never consults CourseCoverage or advances teaching selectors.
 */
export function activateAuthoritySnapshot(
  paths: AuthorityStorePaths,
  input: ActivateAuthoritySnapshotInput,
): ActivateAuthoritySnapshotResult {
  ensureAuthorityStore(paths);
  const teachingBefore = input.teachingSelectors ?? emptyTeachingSelectorFingerprint();
  const activatedAt = input.activatedAt ?? new Date().toISOString();
  const activationReceiptId = input.activationReceiptId
    ?? `activation-${randomUUID()}`;

  let previous: AuthorityCurrentPointer | null = null;
  try {
    previous = readCurrentAuthorityPointer(paths);
  } catch (error) {
    return failActivation({
      paths,
      activationReceiptId,
      snapshotId: input.snapshotId,
      snapshotHash: '0'.repeat(64),
      previous,
      activatedAt,
      teachingBefore,
      reasons: [
        'prior-pointer-unreadable',
        error instanceof Error ? error.message : 'prior pointer unreadable',
      ],
    });
  }

  let staged: LoadedAuthoritySnapshot;
  try {
    staged = loadStagedAuthoritySnapshot(paths, input.snapshotId);
  } catch (error) {
    return failActivation({
      paths,
      activationReceiptId,
      snapshotId: input.snapshotId,
      snapshotHash: previous?.snapshotHash ?? '0'.repeat(64),
      previous,
      activatedAt,
      teachingBefore,
      reasons: [
        'activation-target-incomplete',
        error instanceof Error ? error.message : 'staged snapshot missing',
      ],
    });
  }

  try {
    verifyMaterializedSnapshot({
      manifest: staged.manifest,
      engineering: staged.engineering,
    });
  } catch (error) {
    return failActivation({
      paths,
      activationReceiptId,
      snapshotId: staged.snapshotId,
      snapshotHash: staged.snapshotHash,
      previous,
      activatedAt,
      teachingBefore,
      reasons: [
        'activation-target-drifted',
        error instanceof Error ? error.message : 'digest mismatch',
      ],
    });
  }

  // Capture prior pointer as immutable rollback artifact before replace.
  if (previous) {
    const rollbackId = `rollback-preserve-${previous.snapshotId}-${Date.now()}`;
    writeJsonAtomic(join(paths.rollbacksDir, `${rollbackId}.json`), {
      contract: AUTHORITY_ROLLBACK_RECEIPT_CONTRACT,
      receiptId: rollbackId,
      kind: 'pre-activation-preserve',
      preservedPointer: previous,
      preservedAt: activatedAt,
      forActivationReceiptId: activationReceiptId,
    });
  }

  const pointer: AuthorityCurrentPointer = {
    contract: AUTHORITY_CURRENT_POINTER_CONTRACT,
    snapshotId: staged.snapshotId,
    snapshotHash: staged.snapshotHash,
    releaseId: staged.manifest.releaseId,
    releaseSetId: staged.manifest.releaseSetId,
    activationReceiptId,
    activatedAt,
  };

  try {
    atomicWriteFile(
      paths.currentPointer,
      `${JSON.stringify(pointer, null, 2)}\n`,
    );
  } catch (error) {
    return failActivation({
      paths,
      activationReceiptId,
      snapshotId: staged.snapshotId,
      snapshotHash: staged.snapshotHash,
      previous,
      activatedAt,
      teachingBefore,
      reasons: [
        'pointer-write-failed',
        error instanceof Error ? error.message : 'pointer write failed',
      ],
    });
  }

  // Post-write verification: pointer must re-resolve to the same digest.
  const resolved = resolveActiveAuthoritySnapshot(paths);
  if (
    resolved.status !== 'available'
    || resolved.pointer.snapshotId !== staged.snapshotId
    || resolved.pointer.snapshotHash !== staged.snapshotHash
  ) {
    // Attempt to restore previous pointer if we still have it.
    if (previous) {
      try {
        atomicWriteFile(
          paths.currentPointer,
          `${JSON.stringify(previous, null, 2)}\n`,
        );
      } catch {
        // leave failed state for operator intervention
      }
    } else if (existsSync(paths.currentPointer)) {
      try {
        rmSync(paths.currentPointer);
      } catch {
        // ignore
      }
    }
    return failActivation({
      paths,
      activationReceiptId,
      snapshotId: staged.snapshotId,
      snapshotHash: staged.snapshotHash,
      previous,
      activatedAt,
      teachingBefore,
      reasons: ['post-activation-pointer-mismatch'],
    });
  }

  const teachingAfter = teachingBefore;
  if (!teachingSelectorsEqual(teachingBefore, teachingAfter)) {
    // Defensive: fingerprints are caller-supplied and immutable in this path.
    return failActivation({
      paths,
      activationReceiptId,
      snapshotId: staged.snapshotId,
      snapshotHash: staged.snapshotHash,
      previous,
      activatedAt,
      teachingBefore,
      reasons: ['teaching-selector-drift'],
    });
  }

  const receipt: AuthorityActivationReceipt = {
    contract: AUTHORITY_ACTIVATION_RECEIPT_CONTRACT,
    receiptId: activationReceiptId,
    snapshotId: staged.snapshotId,
    snapshotHash: staged.snapshotHash,
    previousSnapshotId: previous?.snapshotId ?? null,
    previousSnapshotHash: previous?.snapshotHash ?? null,
    activatedAt,
    status: 'activated',
    engineeringConsumersAdvanced: ['engineering-graph', 'engineering-rag'],
    teachingSelectorsAdvanced: false,
    teachingSelectorFingerprintBefore: teachingBefore,
    teachingSelectorFingerprintAfter: teachingAfter,
    teachingProjectionRequired: false,
    courseCoverageRequired: false,
    reasons: [
      'explicit-authority-activation',
      'teaching-projection-not-required',
      'course-coverage-not-consulted',
      'engineering-consumers-only',
    ],
  };
  writeJsonAtomic(join(paths.activationsDir, `${activationReceiptId}.json`), receipt);

  // Mark prior active snapshot lifecycle as superseded (best-effort metadata).
  if (previous && previous.snapshotId !== staged.snapshotId) {
    try {
      const prior = loadStagedAuthoritySnapshot(paths, previous.snapshotId);
      const superseded: AuthoritySnapshotManifest = {
        ...prior.manifest,
        lifecycle: 'superseded',
      };
      writeJsonAtomic(join(releaseDir(paths, previous.snapshotId), 'manifest.json'), superseded);
    } catch {
      // Prior snapshot immutability of engineering body is preserved; lifecycle
      // annotation is best-effort and must not fail activation.
    }
  }
  try {
    const activeManifest: AuthoritySnapshotManifest = {
      ...staged.manifest,
      lifecycle: 'active',
    };
    writeJsonAtomic(join(releaseDir(paths, staged.snapshotId), 'manifest.json'), activeManifest);
  } catch {
    // non-fatal
  }

  return { status: 'activated', receipt, pointer };
}

function failActivation(input: {
  paths: AuthorityStorePaths;
  activationReceiptId: string;
  snapshotId: string;
  snapshotHash: string;
  previous: AuthorityCurrentPointer | null;
  activatedAt: string;
  teachingBefore: TeachingSelectorFingerprint;
  reasons: string[];
}): ActivateAuthoritySnapshotResult {
  const receipt: AuthorityActivationReceipt = {
    contract: AUTHORITY_ACTIVATION_RECEIPT_CONTRACT,
    receiptId: input.activationReceiptId,
    snapshotId: input.snapshotId,
    snapshotHash: input.snapshotHash,
    previousSnapshotId: input.previous?.snapshotId ?? null,
    previousSnapshotHash: input.previous?.snapshotHash ?? null,
    activatedAt: input.activatedAt,
    status: 'failed',
    engineeringConsumersAdvanced: [],
    teachingSelectorsAdvanced: false,
    teachingSelectorFingerprintBefore: input.teachingBefore,
    teachingSelectorFingerprintAfter: input.teachingBefore,
    teachingProjectionRequired: false,
    courseCoverageRequired: false,
    reasons: input.reasons,
  };
  try {
    writeJsonAtomic(
      join(input.paths.activationsDir, `${input.activationReceiptId}.json`),
      receipt,
    );
  } catch {
    // receipt persistence is best-effort on failure path
  }
  return {
    status: 'failed',
    receipt,
    pointer: input.previous,
  };
}

export interface RollbackAuthorityInput {
  /** Target snapshot id (must still exist with matching digest). */
  toSnapshotId: string;
  /** Optional expected digest; when provided must match staged manifest. */
  toSnapshotHash?: string;
  rolledBackAt?: string;
  rollbackReceiptId?: string;
}

export interface RollbackAuthorityResult {
  status: 'rolled-back' | 'failed';
  receipt: AuthorityRollbackReceipt;
  pointer: AuthorityCurrentPointer | null;
}

/**
 * Digest-checked one-pointer rollback. Snapshot directories remain immutable.
 */
export function rollbackAuthorityPointer(
  paths: AuthorityStorePaths,
  input: RollbackAuthorityInput,
): RollbackAuthorityResult {
  ensureAuthorityStore(paths);
  const rolledBackAt = input.rolledBackAt ?? new Date().toISOString();
  const rollbackReceiptId = input.rollbackReceiptId ?? `rollback-${randomUUID()}`;

  let current: AuthorityCurrentPointer | null = null;
  try {
    current = readCurrentAuthorityPointer(paths);
  } catch (error) {
    return failRollback({
      paths,
      rollbackReceiptId,
      fromSnapshotId: 'unknown',
      fromSnapshotHash: '0'.repeat(64),
      toSnapshotId: input.toSnapshotId,
      toSnapshotHash: input.toSnapshotHash ?? '0'.repeat(64),
      rolledBackAt,
      reasons: [
        'current-pointer-unreadable',
        error instanceof Error ? error.message : 'current pointer unreadable',
      ],
    });
  }
  if (!current) {
    return failRollback({
      paths,
      rollbackReceiptId,
      fromSnapshotId: 'none',
      fromSnapshotHash: '0'.repeat(64),
      toSnapshotId: input.toSnapshotId,
      toSnapshotHash: input.toSnapshotHash ?? '0'.repeat(64),
      rolledBackAt,
      reasons: ['no-current-pointer'],
    });
  }

  let target: LoadedAuthoritySnapshot;
  try {
    target = loadStagedAuthoritySnapshot(paths, input.toSnapshotId);
  } catch (error) {
    return failRollback({
      paths,
      rollbackReceiptId,
      fromSnapshotId: current.snapshotId,
      fromSnapshotHash: current.snapshotHash,
      toSnapshotId: input.toSnapshotId,
      toSnapshotHash: input.toSnapshotHash ?? '0'.repeat(64),
      rolledBackAt,
      reasons: [
        'rollback-target-missing',
        error instanceof Error ? error.message : 'target missing',
      ],
    });
  }

  if (input.toSnapshotHash && input.toSnapshotHash !== target.snapshotHash) {
    return failRollback({
      paths,
      rollbackReceiptId,
      fromSnapshotId: current.snapshotId,
      fromSnapshotHash: current.snapshotHash,
      toSnapshotId: target.snapshotId,
      toSnapshotHash: target.snapshotHash,
      rolledBackAt,
      reasons: ['rollback-target-digest-mismatch'],
    });
  }

  const pointer: AuthorityCurrentPointer = {
    contract: AUTHORITY_CURRENT_POINTER_CONTRACT,
    snapshotId: target.snapshotId,
    snapshotHash: target.snapshotHash,
    releaseId: target.manifest.releaseId,
    releaseSetId: target.manifest.releaseSetId,
    activationReceiptId: rollbackReceiptId,
    activatedAt: rolledBackAt,
  };

  // Preserve current pointer before replace.
  writeJsonAtomic(join(paths.rollbacksDir, `${rollbackReceiptId}-from.json`), {
    preservedPointer: current,
    preservedAt: rolledBackAt,
  });

  try {
    atomicWriteFile(paths.currentPointer, `${JSON.stringify(pointer, null, 2)}\n`);
  } catch (error) {
    return failRollback({
      paths,
      rollbackReceiptId,
      fromSnapshotId: current.snapshotId,
      fromSnapshotHash: current.snapshotHash,
      toSnapshotId: target.snapshotId,
      toSnapshotHash: target.snapshotHash,
      rolledBackAt,
      reasons: [
        'rollback-pointer-write-failed',
        error instanceof Error ? error.message : 'pointer write failed',
      ],
    });
  }

  const resolved = resolveActiveAuthoritySnapshot(paths);
  if (
    resolved.status !== 'available'
    || resolved.pointer.snapshotId !== target.snapshotId
    || resolved.pointer.snapshotHash !== target.snapshotHash
  ) {
    try {
      atomicWriteFile(paths.currentPointer, `${JSON.stringify(current, null, 2)}\n`);
    } catch {
      // ignore restore failure
    }
    return failRollback({
      paths,
      rollbackReceiptId,
      fromSnapshotId: current.snapshotId,
      fromSnapshotHash: current.snapshotHash,
      toSnapshotId: target.snapshotId,
      toSnapshotHash: target.snapshotHash,
      rolledBackAt,
      reasons: ['post-rollback-pointer-mismatch'],
    });
  }

  const receipt: AuthorityRollbackReceipt = {
    contract: AUTHORITY_ROLLBACK_RECEIPT_CONTRACT,
    receiptId: rollbackReceiptId,
    fromSnapshotId: current.snapshotId,
    fromSnapshotHash: current.snapshotHash,
    toSnapshotId: target.snapshotId,
    toSnapshotHash: target.snapshotHash,
    rolledBackAt,
    status: 'rolled-back',
    priorSnapshotPreserved: true,
    reasons: ['one-pointer-rollback', 'prior-snapshot-immutable'],
  };
  writeJsonAtomic(join(paths.rollbacksDir, `${rollbackReceiptId}.json`), receipt);
  return { status: 'rolled-back', receipt, pointer };
}

function failRollback(input: {
  paths: AuthorityStorePaths;
  rollbackReceiptId: string;
  fromSnapshotId: string;
  fromSnapshotHash: string;
  toSnapshotId: string;
  toSnapshotHash: string;
  rolledBackAt: string;
  reasons: string[];
}): RollbackAuthorityResult {
  const receipt: AuthorityRollbackReceipt = {
    contract: AUTHORITY_ROLLBACK_RECEIPT_CONTRACT,
    receiptId: input.rollbackReceiptId,
    fromSnapshotId: input.fromSnapshotId,
    fromSnapshotHash: input.fromSnapshotHash,
    toSnapshotId: input.toSnapshotId,
    toSnapshotHash: input.toSnapshotHash,
    rolledBackAt: input.rolledBackAt,
    status: 'failed',
    priorSnapshotPreserved: true,
    reasons: input.reasons,
  };
  try {
    writeJsonAtomic(
      join(input.paths.rollbacksDir, `${input.rollbackReceiptId}.json`),
      receipt,
    );
  } catch {
    // ignore
  }
  let pointer: AuthorityCurrentPointer | null = null;
  try {
    pointer = readCurrentAuthorityPointer(input.paths);
  } catch {
    pointer = null;
  }
  return { status: 'failed', receipt, pointer };
}

/** Deterministic bytes of a staged snapshot (manifest body + engineering). */
export function stagedSnapshotNormalizedBytes(
  snapshot: LoadedAuthoritySnapshot,
): string {
  return authorityCanonicalJson({
    manifestBody: {
      contract: snapshot.manifest.contract,
      releaseSetId: snapshot.manifest.releaseSetId,
      releaseId: snapshot.manifest.releaseId,
      releaseHash: snapshot.manifest.releaseHash,
      releaseVersion: snapshot.manifest.releaseVersion,
      protocol: snapshot.manifest.protocol,
      schemaVersion: snapshot.manifest.schemaVersion,
      bundleDigest: snapshot.manifest.bundleDigest,
      sourceDatasetHash: snapshot.manifest.sourceDatasetHash,
      projectionDigest: snapshot.manifest.projectionDigest,
      projectionId: snapshot.manifest.projectionId,
      predecessorReleaseId: snapshot.manifest.predecessorReleaseId,
      importReceiptId: snapshot.manifest.importReceiptId,
      bundleReceiptId: snapshot.manifest.bundleReceiptId,
      deltaReceiptIds: snapshot.manifest.deltaReceiptIds,
      captureRevision: snapshot.manifest.captureRevision,
      objectCount: snapshot.manifest.objectCount,
      relationCount: snapshot.manifest.relationCount,
      provenance: snapshot.manifest.provenance,
      engineeringDigest: snapshot.manifest.engineeringDigest,
    },
    engineering: snapshot.engineering,
  });
}

export function pointerFileDigest(pointer: AuthorityCurrentPointer): string {
  return authoritySha256(authorityCanonicalJson(pointer));
}

export function assertNoPartialReleaseVisible(
  paths: AuthorityStorePaths,
  snapshotId: string,
): void {
  const dir = releaseDir(paths, snapshotId);
  if (!existsSync(dir)) return;
  const manifestPath = join(dir, 'manifest.json');
  const engineeringPath = join(dir, 'engineering.json');
  if (!existsSync(manifestPath) || !existsSync(engineeringPath)) {
    throw new AuthoritySnapshotError(
      'partial-snapshot',
      `partial snapshot directory exposed: ${snapshotId}`,
    );
  }
  verifyMaterializedSnapshot({
    manifest: readJsonFile(manifestPath),
    engineering: readJsonFile(engineeringPath),
  });
}

// Re-export contract constants used by callers/tests.
export {
  AUTHORITY_SNAPSHOT_CONTRACT,
  AUTHORITY_CURRENT_POINTER_CONTRACT,
  AUTHORITY_STAGE_RECEIPT_CONTRACT,
  AUTHORITY_ACTIVATION_RECEIPT_CONTRACT,
  AUTHORITY_ROLLBACK_RECEIPT_CONTRACT,
};
