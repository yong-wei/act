/**
 * Persist immutable ReleaseSetDeltaReceipt + generic signals.
 *
 * Idempotent on naturalKey / inputDigest. Concurrent inserts converge.
 * Conflicts on same natural key with different output digest fail closed.
 * Signal sets are sealed at creation via expectedSignalCount + DB trigger.
 * Never mutates candidate/active/Legacy selectors.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';

import type {
  ComputedReleaseSetDelta,
  DeltaSignalRecord,
  PersistedDeltaReceiptResult,
} from './release-set-delta-types';
import { assertSignalsAreGeneric } from './release-set-delta-compute';

type Tx = PrismaClient | Prisma.TransactionClient;

const MAX_ATTEMPTS = 8;

export class DeltaPersistError extends Error {
  constructor(message: string) {
    super(`ActKG ReleaseSet Delta persist rejected: ${message}`);
    this.name = 'DeltaPersistError';
  }
}

function fail(message: string): never {
  throw new DeltaPersistError(message);
}

function isRetryableConflict(error: unknown): boolean {
  if (error instanceof PrismaNamespace.PrismaClientKnownRequestError) {
    return error.code === 'P2002' || error.code === 'P2034' || error.code === 'P2028';
  }
  const message = error instanceof Error ? error.message : String(error);
  return /could not serialize|write conflict|deadlock|unique constraint|P2002|P2034/iu.test(message);
}

function receiptIdFor(naturalKey: string): string {
  return `delta-receipt:${naturalKey}`;
}

function signalIdFor(receiptId: string, signalDigest: string): string {
  return `delta-signal:${receiptId}:${signalDigest}`;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * Exact signalDigest set comparison for idempotent / verify-only paths.
 * Order-independent; empty sets allowed (zero-signal packaging revisions).
 */
export function assertSignalDigestSetsMatch(
  persistedDigests: readonly string[],
  expectedDigests: readonly string[],
  label: string,
): void {
  const left = [...persistedDigests].sort();
  const right = [...expectedDigests].sort();
  if (left.length !== right.length) {
    fail(`${label}: signal set cardinality drift (persisted ${left.length}, expected ${right.length})`);
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      fail(`${label}: signalDigest set drift at sorted index ${index}`);
    }
  }
}

function signalDigestsOf(signals: ReadonlyArray<{ signalDigest: string } | DeltaSignalRecord>): string[] {
  return signals.map((row) => row.signalDigest);
}

async function acquireDeltaLock(tx: Tx, naturalKey: string): Promise<void> {
  const token = `actkg-release-set-delta:${naturalKey}`;
  await tx.$queryRaw`
    SELECT (pg_advisory_xact_lock(hashtext(${token})) IS NULL) AS "acquired"
  `;
}

function assertExistingMatchesComputed(
  existing: {
    inputDigest: string;
    outputDigest: string;
    naturalKey: string;
    algorithmVersion: string;
    classification: string;
    authorizationState: string;
    candidateSemanticSnapshotDigest: string;
    baseSemanticSnapshotDigest: string | null;
    expectedSignalCount: number;
    signals: Array<{ signalDigest: string }>;
  },
  computed: ComputedReleaseSetDelta,
  label: string,
): void {
  if (
    existing.inputDigest !== computed.inputDigest
    || existing.outputDigest !== computed.outputDigest
    || existing.naturalKey !== computed.naturalKey
    || existing.algorithmVersion !== computed.algorithmVersion
    || existing.classification !== computed.classification
    || existing.authorizationState !== computed.authorizationState
    || existing.candidateSemanticSnapshotDigest !== computed.candidateSemanticSnapshotDigest
    || (existing.baseSemanticSnapshotDigest ?? null) !== computed.baseSemanticSnapshotDigest
    || existing.expectedSignalCount !== computed.signals.length
  ) {
    fail(`${label}: existing receipt conflicts with recomputed input/output digests or expectedSignalCount`);
  }
  if (computed.authorizationState !== 'ACCEPTED' && existing.signals.length > 0) {
    fail(`${label}: non-accepted receipt must not carry signals`);
  }
  assertSignalDigestSetsMatch(
    signalDigestsOf(existing.signals),
    signalDigestsOf(computed.signals),
    label,
  );
}

async function readExisting(
  tx: Tx,
  computed: ComputedReleaseSetDelta,
): Promise<PersistedDeltaReceiptResult | null> {
  const existing = await tx.actkgReleaseSetDeltaReceipt.findUnique({
    where: { naturalKey: computed.naturalKey },
    include: { signals: true },
  });
  if (!existing) {
    const byInput = await tx.actkgReleaseSetDeltaReceipt.findUnique({
      where: {
        inputDigest_algorithmVersion: {
          inputDigest: computed.inputDigest,
          algorithmVersion: computed.algorithmVersion,
        },
      },
      include: { signals: true },
    });
    if (!byInput) return null;
    assertExistingMatchesComputed(byInput, computed, 'idempotent-by-input');
    return {
      mode: 'idempotent',
      receiptId: byInput.id,
      classification: byInput.classification as PersistedDeltaReceiptResult['classification'],
      authorizationState: byInput.authorizationState as PersistedDeltaReceiptResult['authorizationState'],
      inputDigest: byInput.inputDigest,
      outputDigest: byInput.outputDigest,
      naturalKey: byInput.naturalKey,
      signalCount: byInput.signals.length,
      upstreamCrosscheckStatus: byInput.upstreamCrosscheckStatus as PersistedDeltaReceiptResult['upstreamCrosscheckStatus'],
      selectorsUnchanged: true,
    };
  }

  assertExistingMatchesComputed(existing, computed, 'idempotent-by-natural-key');

  return {
    mode: 'idempotent',
    receiptId: existing.id,
    classification: existing.classification as PersistedDeltaReceiptResult['classification'],
    authorizationState: existing.authorizationState as PersistedDeltaReceiptResult['authorizationState'],
    inputDigest: existing.inputDigest,
    outputDigest: existing.outputDigest,
    naturalKey: existing.naturalKey,
    signalCount: existing.signals.length,
    upstreamCrosscheckStatus: existing.upstreamCrosscheckStatus as PersistedDeltaReceiptResult['upstreamCrosscheckStatus'],
    selectorsUnchanged: true,
  };
}

async function insertReceipt(
  tx: Tx,
  computed: ComputedReleaseSetDelta,
): Promise<PersistedDeltaReceiptResult> {
  assertSignalsAreGeneric(computed.signals);
  if (computed.authorizationState !== 'ACCEPTED' && computed.signals.length > 0) {
    fail('non-accepted delta must not carry governance signals');
  }
  if (computed.authorizationState === 'ACCEPTED' && computed.summary.signalCount !== computed.signals.length) {
    fail('summary.signalCount must equal signals.length for ACCEPTED receipts');
  }

  const expectedSignalCount = computed.signals.length;
  const id = receiptIdFor(computed.naturalKey);
  await tx.actkgReleaseSetDeltaReceipt.create({
    data: {
      id,
      algorithmVersion: computed.algorithmVersion,
      captureRevision: computed.captureRevision,
      classification: computed.classification,
      authorizationState: computed.authorizationState,
      baseEvidenceKind: computed.baseEvidence.kind,
      baseReleaseSetId: computed.baseEvidence.releaseSetId,
      baseReleaseId: computed.baseEvidence.releaseId,
      baseReleaseVersion: computed.baseEvidence.releaseVersion,
      baseReleaseHash: computed.baseEvidence.releaseHash,
      baseSourceDatasetHash: computed.baseEvidence.sourceDatasetHash,
      baseImportReceiptId: computed.baseEvidence.importReceiptId,
      baseBundleReceiptId: computed.baseEvidence.bundleReceiptId,
      baseBundleId: computed.baseEvidence.bundleId,
      baseBundleRevision: computed.baseEvidence.bundleRevision,
      baseBundleDigest: computed.baseEvidence.bundleDigest,
      baseRuntimeProjectionId: computed.baseEvidence.runtimeProjectionId,
      baseRuntimeProjectionDigest: computed.baseEvidence.runtimeProjectionDigest,
      baseEvidenceCaptureRevision: computed.baseEvidence.evidenceCaptureRevision,
      baseSemanticSnapshotDigest: computed.baseSemanticSnapshotDigest,
      candidateEvidenceKind: computed.candidateEvidence.kind,
      candidateReleaseSetId: computed.candidateEvidence.releaseSetId!,
      candidateReleaseId: computed.candidateEvidence.releaseId!,
      candidateReleaseVersion: (() => {
        if (!computed.candidateEvidence.releaseVersion) {
          fail('candidate releaseVersion is required on delta receipt');
        }
        return computed.candidateEvidence.releaseVersion;
      })(),
      candidateReleaseHash: computed.candidateEvidence.releaseHash!,
      candidateSourceDatasetHash: computed.candidateEvidence.sourceDatasetHash!,
      candidateImportReceiptId: computed.candidateEvidence.importReceiptId,
      candidateBundleReceiptId: computed.candidateEvidence.bundleReceiptId,
      candidateBundleId: computed.candidateEvidence.bundleId,
      candidateBundleRevision: computed.candidateEvidence.bundleRevision,
      candidateBundleDigest: computed.candidateEvidence.bundleDigest,
      candidateRuntimeProjectionId: computed.candidateEvidence.runtimeProjectionId,
      candidateRuntimeProjectionDigest: computed.candidateEvidence.runtimeProjectionDigest,
      candidateEvidenceCaptureRevision: (() => {
        if (!computed.candidateEvidence.evidenceCaptureRevision) {
          fail('candidate evidence captureRevision is required on delta receipt');
        }
        return computed.candidateEvidence.evidenceCaptureRevision;
      })(),
      candidateSemanticSnapshotDigest: computed.candidateSemanticSnapshotDigest,
      inputDigest: computed.inputDigest,
      outputDigest: computed.outputDigest,
      details: json(computed.details),
      summary: json(computed.summary),
      identityViolations: json(computed.identityViolations),
      expectedSignalCount,
      upstreamCrosscheckStatus: computed.upstream.status,
      upstreamCrosscheckDetails: json(computed.upstream.details),
      naturalKey: computed.naturalKey,
    },
  });

  // Batch insert within the same transaction while count < expectedSignalCount.
  // Zero-signal ACCEPTED receipts (packaging) leave the set sealed immediately.
  if (computed.authorizationState === 'ACCEPTED' && expectedSignalCount > 0) {
    await tx.actkgReleaseSetDeltaSignal.createMany({
      data: computed.signals.map((row) => ({
        id: signalIdFor(id, row.signalDigest),
        receiptId: id,
        scope: row.scope,
        identity: row.identity,
        action: row.action,
        reason: row.reason,
        digests: row.digests ? json(row.digests) : undefined,
        signalDigest: row.signalDigest,
      })),
    });
  }

  const sealedCount = await tx.actkgReleaseSetDeltaSignal.count({ where: { receiptId: id } });
  if (sealedCount !== expectedSignalCount) {
    fail(`signal seal round-trip failed: expected ${expectedSignalCount}, persisted ${sealedCount}`);
  }

  return {
    mode: 'created',
    receiptId: id,
    classification: computed.classification,
    authorizationState: computed.authorizationState,
    inputDigest: computed.inputDigest,
    outputDigest: computed.outputDigest,
    naturalKey: computed.naturalKey,
    signalCount: sealedCount,
    upstreamCrosscheckStatus: computed.upstream.status,
    selectorsUnchanged: true,
  };
}

/**
 * Persist a computed delta receipt. Does not move selectors.
 */
export async function persistReleaseSetDelta(
  db: PrismaClient,
  computed: ComputedReleaseSetDelta,
): Promise<PersistedDeltaReceiptResult> {
  let attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    try {
      return await db.$transaction(async (tx) => {
        await acquireDeltaLock(tx, computed.naturalKey);
        const existing = await readExisting(tx, computed);
        if (existing) return existing;
        return insertReceipt(tx, computed);
      }, {
        isolationLevel: PrismaNamespace.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isRetryableConflict(error)) {
        throw error;
      }
    }
  }
  fail('exhausted concurrent delta persist retries');
}

/**
 * Verify an already-persisted receipt matches the recomputed delta without writing.
 */
export async function verifyReleaseSetDelta(
  db: PrismaClient,
  computed: ComputedReleaseSetDelta,
): Promise<PersistedDeltaReceiptResult> {
  const existing = await db.actkgReleaseSetDeltaReceipt.findUnique({
    where: { naturalKey: computed.naturalKey },
    include: { signals: true },
  });
  if (!existing) {
    fail(`verify-only: delta receipt missing for natural key ${computed.naturalKey}`);
  }
  if (
    existing.inputDigest !== computed.inputDigest
    || existing.outputDigest !== computed.outputDigest
    || existing.classification !== computed.classification
    || existing.authorizationState !== computed.authorizationState
    || existing.algorithmVersion !== computed.algorithmVersion
    || existing.captureRevision !== computed.captureRevision
    || existing.candidateSemanticSnapshotDigest !== computed.candidateSemanticSnapshotDigest
    || (existing.baseSemanticSnapshotDigest ?? null) !== computed.baseSemanticSnapshotDigest
    || existing.candidateReleaseVersion !== computed.candidateEvidence.releaseVersion
    || existing.candidateBundleId !== computed.candidateEvidence.bundleId
    || existing.candidateBundleRevision !== computed.candidateEvidence.bundleRevision
    || existing.baseBundleId !== computed.baseEvidence.bundleId
    || existing.baseBundleRevision !== computed.baseEvidence.bundleRevision
    || existing.baseEvidenceCaptureRevision !== computed.baseEvidence.evidenceCaptureRevision
    || existing.candidateEvidenceCaptureRevision !== computed.candidateEvidence.evidenceCaptureRevision
    || existing.baseImportReceiptId !== computed.baseEvidence.importReceiptId
    || existing.candidateImportReceiptId !== computed.candidateEvidence.importReceiptId
    || existing.expectedSignalCount !== computed.signals.length
  ) {
    fail('verify-only: persisted delta digests/classification conflict with recomputation');
  }
  if (existing.authorizationState === 'ACCEPTED') {
    assertSignalDigestSetsMatch(
      signalDigestsOf(existing.signals),
      signalDigestsOf(computed.signals),
      'verify-only',
    );
  } else if (existing.signals.length > 0 || existing.expectedSignalCount !== 0) {
    fail('verify-only: non-accepted receipt must not carry signals');
  }

  return {
    mode: 'verify-only',
    receiptId: existing.id,
    classification: existing.classification as PersistedDeltaReceiptResult['classification'],
    authorizationState: existing.authorizationState as PersistedDeltaReceiptResult['authorizationState'],
    inputDigest: existing.inputDigest,
    outputDigest: existing.outputDigest,
    naturalKey: existing.naturalKey,
    signalCount: existing.signals.length,
    upstreamCrosscheckStatus: existing.upstreamCrosscheckStatus as PersistedDeltaReceiptResult['upstreamCrosscheckStatus'],
    selectorsUnchanged: true,
  };
}
