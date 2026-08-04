/**
 * Preflight gates: activation identities + incremental upgrade receipt
 * (#1277 tasks 1.3–1.4).
 */

import type { ConsumerActivationId } from '@/lib/versioned-knowledge-activation/contracts';

import {
  LEGACY_RETIREMENT_INCREMENTAL_UPGRADE_CONTRACT,
  LegacyRetirementGateError,
  type ActivationIdentityEvidence,
  type IncrementalUpgradeReceipt,
} from './contracts';
import { isSha256Hex, retirementDigest } from './hash';

/** Consumers that must be READY under versioned combinations before retirement. */
export const REQUIRED_CUTOVER_CONSUMERS = [
  'konling',
  'course-runtime',
  'learning-path',
  'teaching-resource-rag',
  'engineering-graph',
  'engineering-rag',
] as const satisfies readonly ConsumerActivationId[];

export function buildActivationIdentityEvidence(input: {
  consumerId: ConsumerActivationId | string;
  status: string;
  authorityReleaseId?: string | null;
  authoritySnapshotId?: string | null;
  projectionId?: string | null;
  projectionHash?: string | null;
}): ActivationIdentityEvidence {
  const ready =
    input.status === 'READY'
    && Boolean(input.authorityReleaseId || input.authoritySnapshotId)
    && (
      // Engineering consumers may omit projection.
      input.consumerId === 'engineering-graph'
      || input.consumerId === 'engineering-rag'
      || Boolean(input.projectionId && input.projectionHash)
    );

  return {
    consumerId: input.consumerId,
    status: input.status,
    authorityReleaseId: input.authorityReleaseId ?? null,
    authoritySnapshotId: input.authoritySnapshotId ?? null,
    projectionId: input.projectionId ?? null,
    projectionHash: input.projectionHash ?? null,
    readyUnderVersionedCombination: ready,
  };
}

/**
 * Verify Canonical LearningFacts / Konling (and peer) cutover identities.
 */
export function verifyActivationIdentities(
  identities: readonly ActivationIdentityEvidence[],
  required: readonly string[] = REQUIRED_CUTOVER_CONSUMERS,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const byId = new Map(identities.map((row) => [row.consumerId, row]));

  for (const consumerId of required) {
    const row = byId.get(consumerId);
    if (!row) {
      reasons.push(`activation-identity-missing:${consumerId}`);
      continue;
    }
    if (!row.readyUnderVersionedCombination) {
      reasons.push(
        `activation-not-ready:${consumerId}:status=${row.status}`,
      );
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function assertActivationIdentitiesReady(
  identities: readonly ActivationIdentityEvidence[],
  required?: readonly string[],
): void {
  const result = verifyActivationIdentities(identities, required);
  if (!result.ok) {
    throw new LegacyRetirementGateError(
      'activation-identities-not-ready',
      'required consumers are not READY under versioned combinations',
      result.reasons,
    );
  }
}

/**
 * Build a digest-bound incremental upgrade receipt covering impact, rebuild,
 * consumer activation, and rollback evidence.
 */
export function buildIncrementalUpgradeReceipt(input: {
  receiptId: string;
  deltaIdentity: string;
  deltaOutputDigest: string;
  impactCompleted: boolean;
  projectionRebuildCompleted: boolean;
  consumerActivationCompleted: boolean;
  rollbackEvidenceCompleted: boolean;
  rollbackArchiveDigest?: string | null;
  completedAt: string;
  reasons?: readonly string[];
}): IncrementalUpgradeReceipt {
  if (!isSha256Hex(input.deltaOutputDigest)) {
    throw new LegacyRetirementGateError(
      'invalid-delta-digest',
      'deltaOutputDigest must be sha256 hex',
      ['invalid-delta-output-digest'],
    );
  }
  if (
    input.rollbackArchiveDigest
    && !isSha256Hex(input.rollbackArchiveDigest)
  ) {
    throw new LegacyRetirementGateError(
      'invalid-rollback-digest',
      'rollbackArchiveDigest must be sha256 hex when present',
      ['invalid-rollback-archive-digest'],
    );
  }

  const body = {
    contract: LEGACY_RETIREMENT_INCREMENTAL_UPGRADE_CONTRACT as typeof LEGACY_RETIREMENT_INCREMENTAL_UPGRADE_CONTRACT,
    receiptId: input.receiptId,
    deltaIdentity: input.deltaIdentity,
    deltaOutputDigest: input.deltaOutputDigest,
    impactCompleted: input.impactCompleted,
    projectionRebuildCompleted: input.projectionRebuildCompleted,
    consumerActivationCompleted: input.consumerActivationCompleted,
    rollbackEvidenceCompleted: input.rollbackEvidenceCompleted,
    rollbackArchiveDigest: input.rollbackArchiveDigest ?? null,
    completedAt: input.completedAt,
    reasons: [...(input.reasons ?? [])].sort(),
  };

  return {
    ...body,
    receiptDigest: retirementDigest(body),
  };
}

/**
 * Verify one complete ActKG Delta upgrade → rebuild → activation → rollback.
 */
export function verifyIncrementalUpgradeReceipt(
  receipt: IncrementalUpgradeReceipt,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (receipt.contract !== LEGACY_RETIREMENT_INCREMENTAL_UPGRADE_CONTRACT) {
    reasons.push('upgrade-receipt-contract-mismatch');
  }
  if (!receipt.deltaIdentity) {
    reasons.push('upgrade-delta-identity-missing');
  }
  if (!isSha256Hex(receipt.deltaOutputDigest)) {
    reasons.push('upgrade-delta-digest-invalid');
  }
  if (!receipt.impactCompleted) {
    reasons.push('upgrade-impact-incomplete');
  }
  if (!receipt.projectionRebuildCompleted) {
    reasons.push('upgrade-projection-rebuild-incomplete');
  }
  if (!receipt.consumerActivationCompleted) {
    reasons.push('upgrade-consumer-activation-incomplete');
  }
  if (!receipt.rollbackEvidenceCompleted) {
    reasons.push('upgrade-rollback-evidence-incomplete');
  }
  if (
    receipt.rollbackEvidenceCompleted
    && !isSha256Hex(receipt.rollbackArchiveDigest)
  ) {
    reasons.push('upgrade-rollback-archive-digest-missing');
  }

  const expected = retirementDigest({
    contract: receipt.contract,
    receiptId: receipt.receiptId,
    deltaIdentity: receipt.deltaIdentity,
    deltaOutputDigest: receipt.deltaOutputDigest,
    impactCompleted: receipt.impactCompleted,
    projectionRebuildCompleted: receipt.projectionRebuildCompleted,
    consumerActivationCompleted: receipt.consumerActivationCompleted,
    rollbackEvidenceCompleted: receipt.rollbackEvidenceCompleted,
    rollbackArchiveDigest: receipt.rollbackArchiveDigest,
    completedAt: receipt.completedAt,
    reasons: receipt.reasons,
  });
  if (expected !== receipt.receiptDigest) {
    reasons.push('upgrade-receipt-digest-tamper');
  }

  return { ok: reasons.length === 0, reasons };
}

export function assertIncrementalUpgradeComplete(
  receipt: IncrementalUpgradeReceipt,
): void {
  const result = verifyIncrementalUpgradeReceipt(receipt);
  if (!result.ok) {
    throw new LegacyRetirementGateError(
      'incremental-upgrade-incomplete',
      'complete Delta upgrade / rebuild / activation / rollback evidence required',
      result.reasons,
    );
  }
}
