/**
 * Filesystem consumer activation store: staged releases, atomic current
 * pointer, and digest-checked rollback (#1276).
 *
 * Layout (under activationRoot):
 *   current.json
 *   releases/<activationId>/
 *     activation.json
 *     stage-receipt.json
 *     shadow-report.json   (optional)
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
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import {
  CONSUMER_ACTIVATION_IDS,
  CONSUMER_ACTIVATION_POINTER_CONTRACT,
  CONSUMER_ACTIVATION_RECEIPT_CONTRACT,
  CONSUMER_ACTIVATION_ROLLBACK_RECEIPT_CONTRACT,
  ConsumerActivationError,
  type ConsumerActivationCurrentPointer,
  type ConsumerActivationId,
  type ConsumerActivationManifest,
  type ConsumerActivationReceipt,
  type ConsumerActivationRollbackReceipt,
  type ConsumerActivationShadowReport,
  type ConsumerActivationStageReceipt,
} from './contracts';
import { isSha256Hex } from './hash';
import {
  buildStagedActivationManifest,
  verifyActivationManifest,
  type BuildStagedActivationManifestInput,
} from './stage';
// consumersBlockedByShadow is applied inside buildStagedActivationManifest via
// shadowReport; stageConsumerActivation always forwards the report body.

export const consumerActivationStoreFs = {
  renameSync,
  writeSync,
  openSync,
  closeSync,
  fsyncSync,
};

export interface ConsumerActivationStorePaths {
  root: string;
  currentPointer: string;
  releasesDir: string;
  activationsDir: string;
  rollbacksDir: string;
}

export function resolveConsumerActivationStorePaths(
  activationRoot: string,
): ConsumerActivationStorePaths {
  return {
    root: activationRoot,
    currentPointer: join(activationRoot, 'current.json'),
    releasesDir: join(activationRoot, 'releases'),
    activationsDir: join(activationRoot, 'activations'),
    rollbacksDir: join(activationRoot, 'rollbacks'),
  };
}

export function ensureConsumerActivationStore(
  paths: ConsumerActivationStorePaths,
): void {
  mkdirSync(paths.releasesDir, { recursive: true });
  mkdirSync(paths.activationsDir, { recursive: true });
  mkdirSync(paths.rollbacksDir, { recursive: true });
}

export function releaseDirFor(
  paths: ConsumerActivationStorePaths,
  activationId: string,
): string {
  return join(paths.releasesDir, activationId);
}

/**
 * Atomic JSON write: temp + fsync + rename so readers never observe partial files.
 */
export function atomicWriteFile(
  filePath: string,
  content: string,
  options: { fsync?: boolean } = {},
): void {
  const fsync = options.fsync !== false;
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const fd = consumerActivationStoreFs.openSync(tempPath, 'w');
  try {
    consumerActivationStoreFs.writeSync(fd, content, undefined, 'utf8');
    if (fsync) consumerActivationStoreFs.fsyncSync(fd);
  } finally {
    consumerActivationStoreFs.closeSync(fd);
  }
  consumerActivationStoreFs.renameSync(tempPath, filePath);
  if (fsync) {
    try {
      const dirFd = consumerActivationStoreFs.openSync(dirname(filePath), 'r');
      try {
        consumerActivationStoreFs.fsyncSync(dirFd);
      } finally {
        consumerActivationStoreFs.closeSync(dirFd);
      }
    } catch {
      // Directory fsync is best-effort.
    }
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

export interface StagedConsumerActivationFiles {
  activationId: string;
  activationHash: string;
  releaseDir: string;
  manifest: ConsumerActivationManifest;
  stageReceipt: ConsumerActivationStageReceipt;
  shadowReport: ConsumerActivationShadowReport | null;
  reused: boolean;
}

/**
 * Materialize a complete staged activation release under releases/<id>/.
 * Never mutates current.json.
 */
export function stageConsumerActivation(
  paths: ConsumerActivationStorePaths,
  input: BuildStagedActivationManifestInput,
): StagedConsumerActivationFiles {
  ensureConsumerActivationStore(paths);

  // Always forward shadowReport so material discrepancies auto-block consumers
  // even when the caller omits an explicit shadowConsumerIds list.
  const built = buildStagedActivationManifest({
    ...input,
    shadowReport: input.shadowReport ?? null,
    shadowReportHash:
      input.shadowReportHash
      ?? input.shadowReport?.reportHash
      ?? null,
  });

  if (built.status !== 'staged' || !built.manifest) {
    throw new ConsumerActivationError(
      'stage-failed',
      built.reasons.join('; ') || 'staged activation failed',
    );
  }

  const { manifest, stageReceipt } = built;
  const dir = releaseDirFor(paths, manifest.activationId);
  const manifestPath = join(dir, 'activation.json');

  if (existsSync(manifestPath)) {
    const existing = loadStagedConsumerActivation(paths, manifest.activationId);
    if (existing.activationHash !== manifest.activationHash) {
      throw new ConsumerActivationError(
        'hash-invalid',
        'existing activation identity conflicts with recomputed digest',
      );
    }
    return { ...existing, reused: true };
  }

  const stagingDir = join(
    paths.releasesDir,
    `.staging-${manifest.activationId}.${process.pid}.${randomUUID()}`,
  );
  mkdirSync(stagingDir, { recursive: true });

  try {
    writeJsonAtomic(join(stagingDir, 'activation.json'), manifest);
    writeJsonAtomic(join(stagingDir, 'stage-receipt.json'), stageReceipt);
    if (input.shadowReport) {
      writeJsonAtomic(join(stagingDir, 'shadow-report.json'), input.shadowReport);
    }
    consumerActivationStoreFs.renameSync(stagingDir, dir);
  } catch (error) {
    try {
      if (existsSync(stagingDir)) {
        rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors
    }
    if (error instanceof ConsumerActivationError) throw error;
    throw new ConsumerActivationError(
      'stage-failed',
      error instanceof Error ? error.message : 'stage failed',
    );
  }

  return {
    activationId: manifest.activationId,
    activationHash: manifest.activationHash,
    releaseDir: dir,
    manifest,
    stageReceipt,
    shadowReport: input.shadowReport ?? null,
    reused: false,
  };
}

export function loadStagedConsumerActivation(
  paths: ConsumerActivationStorePaths,
  activationId: string,
): StagedConsumerActivationFiles {
  const dir = releaseDirFor(paths, activationId);
  const manifest = readJsonFile<ConsumerActivationManifest>(
    join(dir, 'activation.json'),
  );
  verifyActivationManifest(manifest);
  if (manifest.activationId !== activationId) {
    throw new ConsumerActivationError(
      'identity-mismatch',
      'activationId does not match release directory',
    );
  }
  const stageReceipt = existsSync(join(dir, 'stage-receipt.json'))
    ? readJsonFile<ConsumerActivationStageReceipt>(join(dir, 'stage-receipt.json'))
    : ({
        contract: 'act-versioned-knowledge-consumer-activation-stage-receipt/v1',
        receiptId: 'missing',
        activationId,
        activationHash: manifest.activationHash,
        stagedAt: manifest.stagedAt,
        status: 'staged' as const,
        reasons: ['stage-receipt-reconstructed'],
        artifactHashes: {},
      } satisfies ConsumerActivationStageReceipt);

  const shadowPath = join(dir, 'shadow-report.json');
  const shadowReport = existsSync(shadowPath)
    ? readJsonFile<ConsumerActivationShadowReport>(shadowPath)
    : null;

  return {
    activationId: manifest.activationId,
    activationHash: manifest.activationHash,
    releaseDir: dir,
    manifest,
    stageReceipt,
    shadowReport,
    reused: true,
  };
}

export function readCurrentConsumerActivationPointer(
  paths: ConsumerActivationStorePaths,
): ConsumerActivationCurrentPointer | null {
  if (!existsSync(paths.currentPointer)) return null;
  const pointer = readJsonFile<ConsumerActivationCurrentPointer>(
    paths.currentPointer,
  );
  if (pointer.contract !== CONSUMER_ACTIVATION_POINTER_CONTRACT) {
    throw new ConsumerActivationError(
      'contract-mismatch',
      'consumer activation current.json contract mismatch',
    );
  }
  if (!pointer.activationId || !isSha256Hex(pointer.activationHash)) {
    throw new ConsumerActivationError(
      'pointer-invalid',
      'consumer activation current.json missing identity',
    );
  }
  return pointer;
}

export interface ResolveActiveConsumerActivationResult {
  status: 'available' | 'unavailable';
  pointer: ConsumerActivationCurrentPointer | null;
  manifest: ConsumerActivationManifest | null;
  detail?: string;
}

/**
 * Resolve the active activation manifest through the digest-checked pointer.
 * Fail closed on missing/mismatched pointer or release.
 */
export function resolveActiveConsumerActivation(
  paths: ConsumerActivationStorePaths,
): ResolveActiveConsumerActivationResult {
  let pointer: ConsumerActivationCurrentPointer | null;
  try {
    pointer = readCurrentConsumerActivationPointer(paths);
  } catch (error) {
    return {
      status: 'unavailable',
      pointer: null,
      manifest: null,
      detail: error instanceof Error ? error.message : 'pointer unreadable',
    };
  }
  if (!pointer) {
    return {
      status: 'unavailable',
      pointer: null,
      manifest: null,
      detail: 'current-pointer-missing',
    };
  }

  // Pointer + release digest are the runtime lock. A receipt is an audit
  // artifact written at activate time; consumers must not wait for it.
  try {
    const staged = loadStagedConsumerActivation(paths, pointer.activationId);
    if (staged.activationHash !== pointer.activationHash) {
      return {
        status: 'unavailable',
        pointer,
        manifest: null,
        detail: 'pointer-release-hash-mismatch',
      };
    }
    return {
      status: 'available',
      pointer,
      manifest: staged.manifest,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      pointer,
      manifest: null,
      detail: error instanceof Error ? error.message : 'release load failed',
    };
  }
}

export interface ActivateConsumerActivationInput {
  activationId: string;
  /**
   * When true (default), refuse activation if no consumer is READY or
   * PINNED_PREVIOUS (completely blocked set).
   */
  requireActionableConsumers?: boolean;
  /**
   * Only advance READY consumers; PINNED/BLOCKED/SHADOW stay as recorded.
   * Activation always writes the full multi-consumer manifest atomically.
   */
  activatedAt?: string;
  activationReceiptId?: string;
}

export interface ActivateConsumerActivationResult {
  status: 'activated' | 'failed';
  receipt: ConsumerActivationReceipt;
  pointer: ConsumerActivationCurrentPointer | null;
}

/**
 * Atomic activation: validate staged release, preserve prior pointer, write
 * receipt, then replace current.json. Engineering consumers may become READY
 * while teaching consumers remain PINNED_PREVIOUS in the same manifest.
 */
export function activateConsumerActivation(
  paths: ConsumerActivationStorePaths,
  input: ActivateConsumerActivationInput,
): ActivateConsumerActivationResult {
  ensureConsumerActivationStore(paths);
  const activatedAt = input.activatedAt ?? new Date().toISOString();
  const activationReceiptId =
    input.activationReceiptId ?? `activation-${randomUUID()}`;

  let previous: ConsumerActivationCurrentPointer | null = null;
  try {
    previous = readCurrentConsumerActivationPointer(paths);
  } catch (error) {
    return failActivation({
      paths,
      activationReceiptId,
      activationId: input.activationId,
      activationHash: '0'.repeat(64),
      previous,
      activatedAt,
      reasons: [
        'prior-pointer-unreadable',
        error instanceof Error ? error.message : 'prior pointer unreadable',
      ],
    });
  }

  let staged: StagedConsumerActivationFiles;
  try {
    staged = loadStagedConsumerActivation(paths, input.activationId);
  } catch (error) {
    return failActivation({
      paths,
      activationReceiptId,
      activationId: input.activationId,
      activationHash: previous?.activationHash ?? '0'.repeat(64),
      previous,
      activatedAt,
      reasons: [
        'activation-target-incomplete',
        error instanceof Error ? error.message : 'staged activation missing',
      ],
    });
  }

  try {
    verifyActivationManifest(staged.manifest);
  } catch (error) {
    return failActivation({
      paths,
      activationReceiptId,
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      previous,
      activatedAt,
      reasons: [
        'activation-target-drifted',
        error instanceof Error ? error.message : 'digest mismatch',
      ],
    });
  }

  // Refuse claiming READY for consumers that are blocked — the staged
  // readiness already encodes pin/block. Activation must not invent READY.
  const ready = staged.manifest.impact.readyConsumerIds;
  const pinned = staged.manifest.impact.pinnedConsumerIds;
  const blocked = staged.manifest.impact.blockedConsumerIds;
  const shadow = staged.manifest.impact.shadowConsumerIds;

  // Bind staged prior* fields to the actual previous pointer so rollback can
  // only restore the real predecessor of this activation (P2).
  if (previous) {
    if (
      staged.manifest.priorActivationId !== previous.activationId
      || staged.manifest.priorActivationHash !== previous.activationHash
    ) {
      return failActivation({
        paths,
        activationReceiptId,
        activationId: staged.activationId,
        activationHash: staged.activationHash,
        previous,
        activatedAt,
        advancedConsumerIds: ready,
        pinnedConsumerIds: pinned,
        blockedConsumerIds: blocked,
        shadowConsumerIds: shadow,
        reasons: [
          'prior-activation-mismatch',
          `expected:${previous.activationId}`,
          `manifest:${staged.manifest.priorActivationId ?? 'null'}`,
        ],
      });
    }
  } else if (
    staged.manifest.priorActivationId
    || staged.manifest.priorActivationHash
  ) {
    return failActivation({
      paths,
      activationReceiptId,
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      previous,
      activatedAt,
      advancedConsumerIds: ready,
      pinnedConsumerIds: pinned,
      blockedConsumerIds: blocked,
      shadowConsumerIds: shadow,
      reasons: [
        'prior-activation-unexpected',
        'no-current-pointer-but-manifest-declares-prior',
      ],
    });
  }

  if (
    input.requireActionableConsumers !== false
    && ready.length === 0
    && pinned.length === 0
  ) {
    return failActivation({
      paths,
      activationReceiptId,
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      previous,
      activatedAt,
      advancedConsumerIds: [],
      pinnedConsumerIds: pinned,
      blockedConsumerIds: blocked,
      shadowConsumerIds: shadow,
      reasons: [
        'no-actionable-consumers',
        'all-consumers-blocked-or-shadow',
      ],
    });
  }

  // Authority-absent / pin-only activations may replace current.json only when
  // every distinct consumer record is PINNED_PREVIOUS. Recompute from
  // consumers[] (not impact array lengths) so duplicated impact IDs cannot
  // fake a full pin set (Codex P1).
  const readyFromRecords = new Set(
    staged.manifest.consumers
      .filter((row) => row.status === 'READY')
      .map((row) => row.consumerId),
  );
  const pinnedFromRecords = new Set(
    staged.manifest.consumers
      .filter((row) => row.status === 'PINNED_PREVIOUS')
      .map((row) => row.consumerId),
  );
  const requiredConsumerSet = new Set(CONSUMER_ACTIVATION_IDS);
  const allConsumersPresent =
    staged.manifest.consumers.length === CONSUMER_ACTIVATION_IDS.length
    && staged.manifest.consumers.every((row) =>
      requiredConsumerSet.has(row.consumerId),
    )
    && new Set(staged.manifest.consumers.map((row) => row.consumerId)).size
      === CONSUMER_ACTIVATION_IDS.length;
  const fullPinOnly =
    readyFromRecords.size === 0
    && allConsumersPresent
    && pinnedFromRecords.size === CONSUMER_ACTIVATION_IDS.length
    && CONSUMER_ACTIVATION_IDS.every((id) => pinnedFromRecords.has(id));
  // Pin-only path requires a complete unique PINNED set derived from records.
  // If impact arrays claim pins/ready but records disagree, fail closed.
  // This gate is NOT optional: requireActionableConsumers must not bypass it.
  if (readyFromRecords.size === 0 && !fullPinOnly) {
    return failActivation({
      paths,
      activationReceiptId,
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      previous,
      activatedAt,
      advancedConsumerIds: [],
      pinnedConsumerIds: pinned,
      blockedConsumerIds: blocked,
      shadowConsumerIds: shadow,
      reasons: [
        'partial-prior-pin-forbidden',
        'authority-absent-requires-full-prior-pins',
        `ready-from-records:${readyFromRecords.size}`,
        `pinned-unique:${pinnedFromRecords.size}`,
        `required:${CONSUMER_ACTIVATION_IDS.length}`,
      ],
    });
  }

  // BLOCKED consumers must never appear as active READY claims.
  for (const row of staged.manifest.consumers) {
    if (row.status === 'BLOCKED_LOCAL_DEPENDENCY' && ready.includes(row.consumerId)) {
      return failActivation({
        paths,
        activationReceiptId,
        activationId: staged.activationId,
        activationHash: staged.activationHash,
        previous,
        activatedAt,
        reasons: ['blocked-consumer-claimed-ready', row.consumerId],
      });
    }
  }

  if (previous) {
    const rollbackId = `rollback-preserve-${previous.activationId}-${Date.now()}`;
    writeJsonAtomic(join(paths.rollbacksDir, `${rollbackId}.json`), {
      contract: CONSUMER_ACTIVATION_ROLLBACK_RECEIPT_CONTRACT,
      receiptId: rollbackId,
      kind: 'pre-activation-preserve',
      preservedPointer: previous,
      preservedAt: activatedAt,
      forActivationReceiptId: activationReceiptId,
    });
  }

  const pointer: ConsumerActivationCurrentPointer = {
    contract: CONSUMER_ACTIVATION_POINTER_CONTRACT,
    activationId: staged.activationId,
    activationHash: staged.activationHash,
    activationReceiptId,
    activatedAt,
  };

  const receipt: ConsumerActivationReceipt = {
    contract: CONSUMER_ACTIVATION_RECEIPT_CONTRACT,
    receiptId: activationReceiptId,
    activationId: staged.activationId,
    activationHash: staged.activationHash,
    previousActivationId: previous?.activationId ?? null,
    previousActivationHash: previous?.activationHash ?? null,
    activatedAt,
    status: 'activated',
    advancedConsumerIds: ready,
    pinnedConsumerIds: pinned,
    blockedConsumerIds: blocked,
    shadowConsumerIds: shadow,
    reasons: [
      'explicit-consumer-activation',
      'atomic-multi-consumer-manifest',
      'engineering-first-pin-teaching-supported',
    ],
  };

  try {
    writeJsonAtomic(
      join(/*turbopackIgnore: true*/ paths.activationsDir, `${activationReceiptId}.json`),
      receipt,
    );
  } catch (error) {
    return failActivation({
      paths,
      activationReceiptId,
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      previous,
      activatedAt,
      advancedConsumerIds: ready,
      pinnedConsumerIds: pinned,
      blockedConsumerIds: blocked,
      shadowConsumerIds: shadow,
      reasons: [
        'activation-receipt-write-failed',
        error instanceof Error ? error.message : 'activation receipt write failed',
        'prior-pointer-untouched',
      ],
    });
  }

  try {
    atomicWriteFile(
      paths.currentPointer,
      `${JSON.stringify(pointer, null, 2)}\n`,
    );
  } catch (error) {
    return failActivation({
      paths,
      activationReceiptId,
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      previous,
      activatedAt,
      advancedConsumerIds: ready,
      pinnedConsumerIds: pinned,
      blockedConsumerIds: blocked,
      shadowConsumerIds: shadow,
      reasons: [
        'pointer-write-failed-after-receipt',
        error instanceof Error ? error.message : 'pointer write failed',
        'prior-pointer-untouched',
      ],
    });
  }

  const resolved = resolveActiveConsumerActivation(paths);
  if (
    resolved.status !== 'available'
    || resolved.pointer?.activationId !== staged.activationId
    || resolved.pointer?.activationHash !== staged.activationHash
    || resolved.pointer?.activationReceiptId !== activationReceiptId
  ) {
    let restoreFailed = false;
    try {
      if (previous) {
        atomicWriteFile(
          paths.currentPointer,
          `${JSON.stringify(previous, null, 2)}\n`,
        );
      } else if (existsSync(paths.currentPointer)) {
        rmSync(paths.currentPointer);
      }
    } catch {
      restoreFailed = true;
    }
    return failActivation({
      paths,
      activationReceiptId,
      activationId: staged.activationId,
      activationHash: staged.activationHash,
      previous,
      activatedAt,
      advancedConsumerIds: ready,
      pinnedConsumerIds: pinned,
      blockedConsumerIds: blocked,
      shadowConsumerIds: shadow,
      reasons: [
        'post-activation-pointer-mismatch',
        restoreFailed ? 'prior-pointer-restore-failed' : 'prior-pointer-restored',
      ],
    });
  }

  return { status: 'activated', receipt, pointer };
}

function failActivation(input: {
  paths: ConsumerActivationStorePaths;
  activationReceiptId: string;
  activationId: string;
  activationHash: string;
  previous: ConsumerActivationCurrentPointer | null;
  activatedAt: string;
  reasons: string[];
  advancedConsumerIds?: ConsumerActivationId[];
  pinnedConsumerIds?: ConsumerActivationId[];
  blockedConsumerIds?: ConsumerActivationId[];
  shadowConsumerIds?: ConsumerActivationId[];
}): ActivateConsumerActivationResult {
  const receipt: ConsumerActivationReceipt = {
    contract: CONSUMER_ACTIVATION_RECEIPT_CONTRACT,
    receiptId: input.activationReceiptId,
    activationId: input.activationId,
    activationHash: input.activationHash,
    previousActivationId: input.previous?.activationId ?? null,
    previousActivationHash: input.previous?.activationHash ?? null,
    activatedAt: input.activatedAt,
    status: 'failed',
    advancedConsumerIds: input.advancedConsumerIds ?? [],
    pinnedConsumerIds: input.pinnedConsumerIds ?? [],
    blockedConsumerIds: input.blockedConsumerIds ?? [],
    shadowConsumerIds: input.shadowConsumerIds ?? [],
    reasons: input.reasons,
  };
  try {
    writeJsonAtomic(
      join(/*turbopackIgnore: true*/ input.paths.activationsDir, `${input.activationReceiptId}.json`),
      receipt,
    );
  } catch {
    // best-effort on failure path
  }
  return {
    status: 'failed',
    receipt,
    pointer: input.previous,
  };
}

export interface RollbackConsumerActivationInput {
  toActivationId: string;
  toActivationHash?: string;
  rolledBackAt?: string;
  rollbackReceiptId?: string;
}

export interface RollbackConsumerActivationResult {
  status: 'rolled-back' | 'failed';
  receipt: ConsumerActivationRollbackReceipt;
  pointer: ConsumerActivationCurrentPointer | null;
}

/**
 * Digest-checked one-pointer rollback to the sole prior activation recorded on
 * the current manifest. Release directories remain immutable. Arbitrary staged
 * releases (even with a matching digest) are rejected when they are not the
 * current list's priorActivationId/priorActivationHash.
 */
export function rollbackConsumerActivation(
  paths: ConsumerActivationStorePaths,
  input: RollbackConsumerActivationInput,
): RollbackConsumerActivationResult {
  ensureConsumerActivationStore(paths);
  const rolledBackAt = input.rolledBackAt ?? new Date().toISOString();
  const rollbackReceiptId =
    input.rollbackReceiptId ?? `rollback-${randomUUID()}`;

  let current: ConsumerActivationCurrentPointer | null = null;
  try {
    current = readCurrentConsumerActivationPointer(paths);
  } catch (error) {
    return failRollback({
      paths,
      rollbackReceiptId,
      from: null,
      toActivationId: input.toActivationId,
      toActivationHash: input.toActivationHash ?? '0'.repeat(64),
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
      from: null,
      toActivationId: input.toActivationId,
      toActivationHash: input.toActivationHash ?? '0'.repeat(64),
      rolledBackAt,
      reasons: ['current-pointer-missing'],
    });
  }

  // Sole allowed rollback target is the prior activation recorded on the
  // currently active manifest (not any arbitrary staged release).
  let currentManifest: ConsumerActivationManifest;
  try {
    const active = resolveActiveConsumerActivation(paths);
    if (active.status !== 'available' || !active.manifest) {
      return failRollback({
        paths,
        rollbackReceiptId,
        from: current,
        toActivationId: input.toActivationId,
        toActivationHash: input.toActivationHash ?? current.activationHash,
        rolledBackAt,
        reasons: [
          'current-activation-unavailable',
          active.detail ?? 'active-manifest-missing',
        ],
      });
    }
    currentManifest = active.manifest;
  } catch (error) {
    return failRollback({
      paths,
      rollbackReceiptId,
      from: current,
      toActivationId: input.toActivationId,
      toActivationHash: input.toActivationHash ?? current.activationHash,
      rolledBackAt,
      reasons: [
        'current-activation-unreadable',
        error instanceof Error ? error.message : 'current activation unreadable',
      ],
    });
  }

  const allowedPriorId = currentManifest.priorActivationId;
  const allowedPriorHash = currentManifest.priorActivationHash;
  if (!allowedPriorId || !allowedPriorHash || !isSha256Hex(allowedPriorHash)) {
    return failRollback({
      paths,
      rollbackReceiptId,
      from: current,
      toActivationId: input.toActivationId,
      toActivationHash: input.toActivationHash ?? '0'.repeat(64),
      rolledBackAt,
      reasons: ['no-prior-activation-recorded'],
    });
  }

  if (input.toActivationId !== allowedPriorId) {
    return failRollback({
      paths,
      rollbackReceiptId,
      from: current,
      toActivationId: input.toActivationId,
      toActivationHash: input.toActivationHash ?? allowedPriorHash,
      rolledBackAt,
      reasons: [
        'rollback-target-not-prior',
        `allowed:${allowedPriorId}`,
        `requested:${input.toActivationId}`,
      ],
    });
  }

  // Explicit caller hash (when provided) must match the recorded prior hash.
  if (
    input.toActivationHash
    && input.toActivationHash !== allowedPriorHash
  ) {
    return failRollback({
      paths,
      rollbackReceiptId,
      from: current,
      toActivationId: allowedPriorId,
      toActivationHash: allowedPriorHash,
      rolledBackAt,
      reasons: ['rollback-target-digest-mismatch'],
    });
  }

  let target: StagedConsumerActivationFiles;
  try {
    target = loadStagedConsumerActivation(paths, allowedPriorId);
  } catch (error) {
    return failRollback({
      paths,
      rollbackReceiptId,
      from: current,
      toActivationId: allowedPriorId,
      toActivationHash: allowedPriorHash,
      rolledBackAt,
      reasons: [
        'rollback-target-missing',
        error instanceof Error ? error.message : 'target missing',
      ],
    });
  }

  // Always enforce the recorded prior digest against the immutable release.
  if (target.activationHash !== allowedPriorHash) {
    return failRollback({
      paths,
      rollbackReceiptId,
      from: current,
      toActivationId: target.activationId,
      toActivationHash: target.activationHash,
      rolledBackAt,
      reasons: ['rollback-target-digest-mismatch', 'prior-hash-release-drift'],
    });
  }

  const pointer: ConsumerActivationCurrentPointer = {
    contract: CONSUMER_ACTIVATION_POINTER_CONTRACT,
    activationId: target.activationId,
    activationHash: target.activationHash,
    activationReceiptId: rollbackReceiptId,
    activatedAt: rolledBackAt,
  };

  const receipt: ConsumerActivationRollbackReceipt = {
    contract: CONSUMER_ACTIVATION_ROLLBACK_RECEIPT_CONTRACT,
    receiptId: rollbackReceiptId,
    fromActivationId: current.activationId,
    fromActivationHash: current.activationHash,
    toActivationId: target.activationId,
    toActivationHash: target.activationHash,
    rolledBackAt,
    status: 'rolled-back',
    reasons: [
      'one-pointer-rollback',
      'prior-activation-immutable',
      'prior-activation-from-current-manifest',
    ],
  };

  try {
    writeJsonAtomic(
      join(/*turbopackIgnore: true*/ paths.rollbacksDir, `${rollbackReceiptId}.json`),
      receipt,
    );
  } catch (error) {
    return failRollback({
      paths,
      rollbackReceiptId,
      from: current,
      toActivationId: target.activationId,
      toActivationHash: target.activationHash,
      rolledBackAt,
      reasons: [
        'rollback-receipt-write-failed',
        error instanceof Error ? error.message : 'rollback receipt write failed',
      ],
    });
  }

  try {
    atomicWriteFile(
      paths.currentPointer,
      `${JSON.stringify(pointer, null, 2)}\n`,
    );
  } catch (error) {
    return failRollback({
      paths,
      rollbackReceiptId,
      from: current,
      toActivationId: target.activationId,
      toActivationHash: target.activationHash,
      rolledBackAt,
      reasons: [
        'rollback-pointer-write-failed',
        error instanceof Error ? error.message : 'pointer write failed',
      ],
    });
  }

  const resolved = resolveActiveConsumerActivation(paths);
  if (
    resolved.status !== 'available'
    || resolved.pointer?.activationId !== target.activationId
    || resolved.pointer?.activationHash !== target.activationHash
  ) {
    try {
      if (current) {
        atomicWriteFile(
          paths.currentPointer,
          `${JSON.stringify(current, null, 2)}\n`,
        );
      }
    } catch {
      // fail closed
    }
    return failRollback({
      paths,
      rollbackReceiptId,
      from: current,
      toActivationId: target.activationId,
      toActivationHash: target.activationHash,
      rolledBackAt,
      reasons: ['post-rollback-pointer-mismatch'],
    });
  }

  return { status: 'rolled-back', receipt, pointer };
}

function failRollback(input: {
  paths: ConsumerActivationStorePaths;
  rollbackReceiptId: string;
  from: ConsumerActivationCurrentPointer | null;
  toActivationId: string;
  toActivationHash: string;
  rolledBackAt: string;
  reasons: string[];
}): RollbackConsumerActivationResult {
  const receipt: ConsumerActivationRollbackReceipt = {
    contract: CONSUMER_ACTIVATION_ROLLBACK_RECEIPT_CONTRACT,
    receiptId: input.rollbackReceiptId,
    fromActivationId: input.from?.activationId ?? null,
    fromActivationHash: input.from?.activationHash ?? null,
    toActivationId: input.toActivationId,
    toActivationHash: input.toActivationHash,
    rolledBackAt: input.rolledBackAt,
    status: 'failed',
    reasons: input.reasons,
  };
  try {
    writeJsonAtomic(
      join(/*turbopackIgnore: true*/ input.paths.rollbacksDir, `${input.rollbackReceiptId}.json`),
      receipt,
    );
  } catch {
    // best-effort
  }
  return {
    status: 'failed',
    receipt,
    pointer: input.from,
  };
}
