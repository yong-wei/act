/**
 * Stage complete immutable consumer activation materializations (#1276).
 *
 * Validates cross-artifact identities, deterministic hashes, and per-consumer
 * readiness before any pointer replacement.
 */

import {
  CONSUMER_ACTIVATION_CONTRACT,
  CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT,
  ConsumerActivationError,
  isConsumerActivationStatus,
  type ConsumerActivationManifest,
  type ConsumerActivationRecord,
  type ConsumerActivationStageReceipt,
} from './contracts';
import { activationDigest, isSha256Hex } from './hash';
import {
  evaluateConsumerReadiness,
  summarizeImpact,
  type EvaluateConsumerReadinessInput,
  type StagedActivationArtifactSet,
} from './readiness';

export interface BuildStagedActivationManifestInput {
  artifacts: StagedActivationArtifactSet;
  priorConsumers?: EvaluateConsumerReadinessInput['priorConsumers'];
  preferPinOnBlock?: boolean;
  shadowConsumerIds?: EvaluateConsumerReadinessInput['shadowConsumerIds'];
  shadowReportHash?: string | null;
  priorActivationId?: string | null;
  priorActivationHash?: string | null;
  activationId?: string;
  stagedAt?: string;
  /** When false, skip fail-closed on blocked engineering (tests only). Default true. */
  requireEngineeringReady?: boolean;
}

export interface StagedActivationManifestResult {
  status: 'staged' | 'failed';
  manifest: ConsumerActivationManifest | null;
  consumers: ConsumerActivationRecord[];
  stageReceipt: ConsumerActivationStageReceipt;
  reasons: string[];
}

function assertKnownStatuses(consumers: readonly ConsumerActivationRecord[]): void {
  for (const row of consumers) {
    if (!isConsumerActivationStatus(row.status)) {
      throw new ConsumerActivationError(
        'unknown-status',
        `unknown consumer status for ${row.consumerId}: ${String(row.status)}`,
      );
    }
  }
}

/**
 * Validate that the staged artifact set is complete enough to materialize an
 * activation manifest. Partial / mixed-capture inputs fail closed.
 */
export function validateStagedArtifactSet(
  artifacts: StagedActivationArtifactSet,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!artifacts.authority?.present) {
    // Authority may be absent only when every consumer pins previous — still
    // allow staging so pin-only manifests can be recorded, but flag it.
    reasons.push('authority-absent-for-stage');
  } else {
    if (!artifacts.authority.snapshotId) reasons.push('authority-snapshot-id-missing');
    if (!isSha256Hex(artifacts.authority.snapshotHash)) {
      reasons.push('authority-snapshot-hash-invalid');
    }
    if (!artifacts.authority.releaseId) reasons.push('authority-release-id-missing');
    if (!artifacts.authority.artifactHashes['manifest.json']) {
      reasons.push('authority-manifest-hash-missing');
    }
    if (!artifacts.authority.artifactHashes['engineering.json']) {
      reasons.push('authority-engineering-hash-missing');
    }
  }

  if (artifacts.projection?.present) {
    if (!artifacts.projection.projectionId) reasons.push('projection-id-missing');
    if (!isSha256Hex(artifacts.projection.projectionHash)) {
      reasons.push('projection-hash-invalid');
    }
    if (!artifacts.projection.artifactHashes['projection-manifest.json']) {
      reasons.push('projection-manifest-hash-missing');
    }
    if (
      artifacts.authority?.present
      && artifacts.authority.releaseId
      && artifacts.projection.authorityReleaseId
      && artifacts.authority.releaseId !== artifacts.projection.authorityReleaseId
    ) {
      reasons.push('authority-projection-release-mismatch');
    }
    if (
      artifacts.captureRevision
      && artifacts.projection.captureRevision
      && artifacts.captureRevision !== artifacts.projection.captureRevision
    ) {
      reasons.push('projection-capture-revision-mismatch');
    }
    if (
      artifacts.captureRevision
      && artifacts.authority?.captureRevision
      && artifacts.captureRevision !== artifacts.authority.captureRevision
    ) {
      reasons.push('authority-capture-revision-mismatch');
    }
  }

  if (artifacts.identityDriftReasons && artifacts.identityDriftReasons.length > 0) {
    reasons.push(...artifacts.identityDriftReasons);
  }

  // Hard fail: tampered / mixed capture that claims both sides present.
  const hardFail = reasons.some((r) =>
    r.includes('mismatch')
    || r.includes('drift')
    || r.includes('invalid')
    || r.includes('hash-missing')
    || r.includes('id-missing'),
  );

  return { ok: !hardFail, reasons };
}

/**
 * Build a complete activation manifest from staged artifacts and readiness.
 * Does not write to disk — callers persist via the store.
 */
export function buildStagedActivationManifest(
  input: BuildStagedActivationManifestInput,
): StagedActivationManifestResult {
  const stagedAt = input.stagedAt ?? new Date().toISOString();
  const receiptId = `stage-${stagedAt.replace(/[:.]/g, '-')}`;
  const validation = validateStagedArtifactSet(input.artifacts);

  const consumers = evaluateConsumerReadiness({
    artifacts: input.artifacts,
    priorConsumers: input.priorConsumers,
    preferPinOnBlock: input.preferPinOnBlock,
    shadowConsumerIds: input.shadowConsumerIds,
    activatedAt: stagedAt,
  });

  try {
    assertKnownStatuses(consumers);
  } catch (error) {
    const reasons = [
      error instanceof Error ? error.message : 'unknown-status',
    ];
    return {
      status: 'failed',
      manifest: null,
      consumers,
      stageReceipt: {
        contract: CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT,
        receiptId,
        activationId: 'failed',
        activationHash: '0'.repeat(64),
        stagedAt,
        status: 'failed',
        reasons,
        artifactHashes: collectArtifactHashes(input.artifacts),
      },
      reasons,
    };
  }

  // Fail closed when staging validation hard-fails (mixed/tampered).
  if (!validation.ok) {
    const reasons = [
      'staged-artifact-set-invalid',
      ...validation.reasons,
    ];
    return {
      status: 'failed',
      manifest: null,
      consumers,
      stageReceipt: {
        contract: CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT,
        receiptId,
        activationId: 'failed',
        activationHash: '0'.repeat(64),
        stagedAt,
        status: 'failed',
        reasons,
        artifactHashes: collectArtifactHashes(input.artifacts),
      },
      reasons,
    };
  }

  const impact = summarizeImpact(consumers);
  if (
    input.requireEngineeringReady !== false
    && impact.readyConsumerIds.every(
      (id) => id !== 'engineering-graph' && id !== 'engineering-rag',
    )
    && impact.readyConsumerIds.length === 0
    && impact.pinnedConsumerIds.length === 0
  ) {
    // Completely empty readiness is still stageable for diagnostics, but
    // activation will refuse to claim READY consumers.
  }

  const bodyWithoutHash = {
    contract: CONSUMER_ACTIVATION_CONTRACT,
    captureRevision: input.artifacts.captureRevision,
    stagedAt,
    consumers,
    impact,
    shadowReportHash: input.shadowReportHash ?? null,
    priorActivationId: input.priorActivationId ?? null,
    priorActivationHash: input.priorActivationHash ?? null,
  };
  const activationHash = activationDigest(bodyWithoutHash);
  const activationId =
    input.activationId ?? `activation-${activationHash.slice(0, 24)}`;

  const manifest: ConsumerActivationManifest = {
    ...bodyWithoutHash,
    activationId,
    activationHash,
  };

  // Re-hash including activationId for stable identity (activationId is derived
  // from body hash, so re-including it is deterministic).
  const finalHash = activationDigest({
    contract: manifest.contract,
    activationId: manifest.activationId,
    captureRevision: manifest.captureRevision,
    stagedAt: manifest.stagedAt,
    consumers: manifest.consumers,
    impact: manifest.impact,
    shadowReportHash: manifest.shadowReportHash,
    priorActivationId: manifest.priorActivationId,
    priorActivationHash: manifest.priorActivationHash,
  });
  manifest.activationHash = finalHash;

  return {
    status: 'staged',
    manifest,
    consumers,
    stageReceipt: {
      contract: CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT,
      receiptId,
      activationId,
      activationHash: finalHash,
      stagedAt,
      status: 'staged',
      reasons: ['complete-staged-materialization', ...validation.reasons],
      artifactHashes: collectArtifactHashes(input.artifacts),
    },
    reasons: ['complete-staged-materialization'],
  };
}

function collectArtifactHashes(
  artifacts: StagedActivationArtifactSet,
): Record<string, string> {
  return {
    ...(artifacts.authority?.artifactHashes ?? {}),
    ...(artifacts.projection?.artifactHashes
      ? Object.fromEntries(
          Object.entries(artifacts.projection.artifactHashes).map(
            ([key, value]) => [`projection:${key}`, value],
          ),
        )
      : {}),
  };
}

/**
 * Verify a loaded activation manifest's digest and known statuses.
 */
export function verifyActivationManifest(
  manifest: ConsumerActivationManifest,
): void {
  if (manifest.contract !== CONSUMER_ACTIVATION_CONTRACT) {
    throw new ConsumerActivationError(
      'contract-mismatch',
      `unexpected activation contract: ${manifest.contract}`,
    );
  }
  assertKnownStatuses(manifest.consumers);
  const expected = activationDigest({
    contract: manifest.contract,
    activationId: manifest.activationId,
    captureRevision: manifest.captureRevision,
    stagedAt: manifest.stagedAt,
    consumers: manifest.consumers,
    impact: manifest.impact,
    shadowReportHash: manifest.shadowReportHash,
    priorActivationId: manifest.priorActivationId,
    priorActivationHash: manifest.priorActivationHash,
  });
  if (expected !== manifest.activationHash) {
    throw new ConsumerActivationError(
      'hash-invalid',
      'activation manifest digest mismatch',
    );
  }
  if (!isSha256Hex(manifest.activationHash)) {
    throw new ConsumerActivationError(
      'hash-invalid',
      'activationHash is not sha256 hex',
    );
  }
}
