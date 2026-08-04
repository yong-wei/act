/**
 * Immutable retirement manifest builder (#1277 task 2.2).
 *
 * Fail closed on missing evidence or activation coupling.
 */

import {
  LEGACY_RETIREMENT_BUILDER_VERSION,
  LEGACY_RETIREMENT_MANIFEST_CONTRACT,
  LEGACY_RETIREMENT_REMOVAL_RECEIPT_CONTRACT,
  LegacyRetirementGateError,
  RETIREABLE_RUNTIME_DEPENDENCIES,
  type ActivationIdentityEvidence,
  type FallbackTelemetryExport,
  type IncrementalUpgradeReceipt,
  type OldIdScanReport,
  type RemovalReceipt,
  type RemovedDependencyRecord,
  type RetirementArchive,
  type RetirementChangeSurface,
  type RetirementConsumerInventory,
  type RetirementManifest,
  type RetireableRuntimeDependency,
} from './contracts';
import { isSha256Hex, retirementDigest } from './hash';
import {
  assertActivationIdentitiesReady,
  assertIncrementalUpgradeComplete,
  buildActivationIdentityEvidence,
  verifyActivationIdentities,
  verifyIncrementalUpgradeReceipt,
} from './preflight';
import { assertZeroFallbackHits } from './fallback-export';
import { assertZeroOldIdViolations } from './old-id-scan';

const RETIREMENT_INVARIANTS = {
  doesNotModifyActivationPointers: true as const,
  doesNotDeleteHistoricalEvidence: true as const,
  doesNotDeployRemotely: true as const,
  doesNotIncludePrismaMigration: true as const,
  doesNotIncludeUpstreamSemanticReview: true as const,
  failClosedOnMissingEvidence: true as const,
};

/** Recompute digest over a document body excluding the terminal digest field. */
function recomputeTerminalDigest(
  doc: Record<string, unknown>,
  digestField: string,
): string {
  const { [digestField]: _ignored, ...rest } = doc;
  return retirementDigest(rest);
}

/**
 * Reject activation+retirement coupling (must be separate change/PR).
 */
export function assertNoActivationCoupling(
  surface: RetirementChangeSurface,
): void {
  const reasons: string[] = [];
  if (surface.modifiesActivationPointers && surface.removesLegacyReaders) {
    reasons.push('activation-and-retirement-combined');
  }
  if (surface.touchesRemoteDeployment) {
    reasons.push('remote-deployment-not-allowed');
  }
  if (surface.includesPrismaMigration) {
    reasons.push('prisma-migration-not-allowed');
  }
  if (surface.includesUpstreamSemanticReview) {
    reasons.push('upstream-semantic-review-not-allowed');
  }
  if (reasons.length > 0) {
    throw new LegacyRetirementGateError(
      'retirement-out-of-contract',
      `validation rejected retirement change as out of contract: ${reasons.join(', ')}`,
      reasons,
    );
  }
}

function defaultRemovedDependencies(
  remove: boolean,
): RemovedDependencyRecord[] {
  return RETIREABLE_RUNTIME_DEPENDENCIES.map((dependencyId) => ({
    dependencyId,
    removed: remove,
    reason: remove
      ? 'retirement-gate-passed'
      : 'awaiting-retirement-gate',
    retainedHistoricalAdapter:
      dependencyId === 'legacy-card-direct-reader'
        ? 'historical-learning-fact-crosswalk-adapter'
        : dependencyId === 'global-course-coverage-runtime-selector'
          ? 'legacy-course-coverage-audit-manifest'
          : dependencyId === 'legacy-runtime-graph-overlay-reader'
            ? 'historical-authority-projection-snapshots'
            : 'digest-verified-rollback-archive',
  }));
}

export interface BuildRetirementManifestInput {
  retirementId: string;
  captureRevision?: string | null;
  headRevision?: string | null;
  reviewedAt?: string | null;
  inventory: RetirementConsumerInventory;
  oldIdScan: OldIdScanReport;
  fallbackExport: FallbackTelemetryExport;
  archive: RetirementArchive;
  upgradeReceipt: IncrementalUpgradeReceipt;
  activationIdentities: readonly ActivationIdentityEvidence[];
  /**
   * When true, mark dependencies as removed in the manifest (post-gate).
   * Default false — preflight only.
   */
  markRemoved?: boolean;
  changeSurface?: RetirementChangeSurface;
}

/**
 * Build the immutable retirement manifest. Missing/invalid evidence yields
 * status `blocked` with exact reasons (fail closed). Throws only on
 * activation coupling / out-of-contract change surfaces.
 */
export function buildRetirementManifest(
  input: BuildRetirementManifestInput,
): RetirementManifest {
  if (input.changeSurface) {
    assertNoActivationCoupling(input.changeSurface);
  }

  const reasons: string[] = [];

  // Recompute evidence digests from full document bodies (fail closed on tamper).
  const inventoryDigestExpected = recomputeTerminalDigest(
    input.inventory as unknown as Record<string, unknown>,
    'inventoryDigest',
  );
  if (
    !isSha256Hex(input.inventory.inventoryDigest)
    || input.inventory.inventoryDigest !== inventoryDigestExpected
  ) {
    reasons.push(
      !isSha256Hex(input.inventory.inventoryDigest)
        ? 'inventory-digest-missing'
        : 'inventory-digest-tamper',
    );
  }

  const scanDigestExpected = recomputeTerminalDigest(
    input.oldIdScan as unknown as Record<string, unknown>,
    'scanDigest',
  );
  if (
    !isSha256Hex(input.oldIdScan.scanDigest)
    || input.oldIdScan.scanDigest !== scanDigestExpected
  ) {
    reasons.push(
      !isSha256Hex(input.oldIdScan.scanDigest)
        ? 'old-id-scan-digest-missing'
        : 'old-id-scan-digest-tamper',
    );
  }

  const fallbackDigestExpected = recomputeTerminalDigest(
    input.fallbackExport as unknown as Record<string, unknown>,
    'exportDigest',
  );
  if (
    !isSha256Hex(input.fallbackExport.exportDigest)
    || input.fallbackExport.exportDigest !== fallbackDigestExpected
  ) {
    reasons.push(
      !isSha256Hex(input.fallbackExport.exportDigest)
        ? 'fallback-export-digest-missing'
        : 'fallback-export-digest-tamper',
    );
  }

  const archiveDigestExpected = recomputeTerminalDigest(
    input.archive as unknown as Record<string, unknown>,
    'archiveDigest',
  );
  if (
    !isSha256Hex(input.archive.archiveDigest)
    || input.archive.archiveDigest !== archiveDigestExpected
  ) {
    reasons.push(
      !isSha256Hex(input.archive.archiveDigest)
        ? 'archive-digest-missing'
        : 'archive-digest-tamper',
    );
  }

  // Upgrade receipt already has verifyIncrementalUpgradeReceipt which recomputes.
  if (
    !input.upgradeReceipt.receiptDigest
    || !isSha256Hex(input.upgradeReceipt.receiptDigest)
  ) {
    reasons.push('upgrade-receipt-digest-missing');
  }

  // Capture revision must bind inventory / scan / archive to one Git revision.
  const captureRevisions = [
    input.inventory.captureRevision,
    input.oldIdScan.captureRevision,
    input.archive.captureRevision,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (captureRevisions.length < 3) {
    reasons.push('capture-revision-incomplete');
  } else if (new Set(captureRevisions).size !== 1) {
    reasons.push('capture-revision-mismatch');
  } else if (
    input.captureRevision
    && input.captureRevision !== captureRevisions[0]
  ) {
    reasons.push('capture-revision-head-mismatch');
  }

  try {
    assertZeroOldIdViolations(input.oldIdScan);
  } catch (error) {
    reasons.push(
      error instanceof Error ? error.message : 'old-id-scan-failed',
    );
  }

  try {
    assertZeroFallbackHits(input.fallbackExport);
  } catch (error) {
    if (error instanceof LegacyRetirementGateError) {
      reasons.push(...error.reasons);
    } else {
      reasons.push(
        error instanceof Error ? error.message : 'fallback-export-failed',
      );
    }
  }

  // Re-evaluate readiness from raw identity fields (do not trust a forged flag).
  const recomputedIdentities = input.activationIdentities.map((row) =>
    buildActivationIdentityEvidence({
      consumerId: row.consumerId,
      status: row.status,
      authorityReleaseId: row.authorityReleaseId,
      authoritySnapshotId: row.authoritySnapshotId,
      projectionId: row.projectionId,
      projectionHash: row.projectionHash,
    }),
  );
  const activation = verifyActivationIdentities(recomputedIdentities);
  if (!activation.ok) {
    reasons.push(...activation.reasons);
  }

  const upgrade = verifyIncrementalUpgradeReceipt(input.upgradeReceipt);
  if (!upgrade.ok) {
    reasons.push(...upgrade.reasons);
  }

  // Missing activation identity list entirely.
  if (input.activationIdentities.length === 0) {
    reasons.push('activation-identities-absent');
  }

  const markRemoved = input.markRemoved === true && reasons.length === 0;
  const status: RetirementManifest['status'] =
    reasons.length > 0
      ? 'blocked'
      : markRemoved
        ? 'removed'
        : 'ready-for-removal';

  const removedDependencies = defaultRemovedDependencies(markRemoved);

  const body = {
    contract: LEGACY_RETIREMENT_MANIFEST_CONTRACT as typeof LEGACY_RETIREMENT_MANIFEST_CONTRACT,
    builderVersion: LEGACY_RETIREMENT_BUILDER_VERSION as typeof LEGACY_RETIREMENT_BUILDER_VERSION,
    retirementId: input.retirementId,
    captureRevision: input.captureRevision ?? null,
    headRevision: input.headRevision ?? null,
    reviewedAt: input.reviewedAt ?? null,
    inventoryDigest: input.inventory.inventoryDigest,
    oldIdScanDigest: input.oldIdScan.scanDigest,
    fallbackExportDigest: input.fallbackExport.exportDigest,
    archiveDigest: input.archive.archiveDigest,
    incrementalUpgradeReceiptDigest: input.upgradeReceipt.receiptDigest,
    activationIdentities: [...recomputedIdentities].sort((a, b) =>
      String(a.consumerId) < String(b.consumerId)
        ? -1
        : String(a.consumerId) > String(b.consumerId)
          ? 1
          : 0,
    ),
    removedDependencies,
    invariants: RETIREMENT_INVARIANTS,
    status,
    reasons: [...reasons].sort(),
  };

  return {
    ...body,
    manifestDigest: retirementDigest(body),
  };
}

/**
 * Fail closed: only ready-for-removal / removed manifests may delete runtime
 * dependencies.
 */
export function assertRetirementManifestReady(
  manifest: RetirementManifest,
): void {
  if (manifest.contract !== LEGACY_RETIREMENT_MANIFEST_CONTRACT) {
    throw new LegacyRetirementGateError(
      'manifest-contract-mismatch',
      'retirement manifest contract mismatch',
    );
  }
  if (
    manifest.status !== 'ready-for-removal'
    && manifest.status !== 'removed'
  ) {
    throw new LegacyRetirementGateError(
      'retirement-blocked',
      'retirement remains blocked until preconditions are complete',
      manifest.reasons,
    );
  }
  if (!manifest.invariants.doesNotModifyActivationPointers) {
    throw new LegacyRetirementGateError(
      'activation-pointer-mutation-forbidden',
      'retirement must not modify activation pointers',
    );
  }
  if (!isSha256Hex(manifest.manifestDigest)) {
    throw new LegacyRetirementGateError(
      'manifest-digest-invalid',
      'retirement manifestDigest must be sha256 hex',
    );
  }

  // Recompute digest over body excluding manifestDigest.
  const { manifestDigest: _ignored, ...rest } = manifest;
  const expected = retirementDigest(rest);
  if (expected !== manifest.manifestDigest) {
    throw new LegacyRetirementGateError(
      'manifest-digest-tamper',
      'retirement manifest digest does not match content',
      ['manifest-digest-tamper'],
    );
  }
}

/**
 * Issue a removal receipt only when the manifest gate passes.
 */
export function issueRemovalReceipt(input: {
  receiptId: string;
  manifest: RetirementManifest;
  removedAt: string;
  dependencies?: readonly RetireableRuntimeDependency[];
}): RemovalReceipt {
  try {
    assertRetirementManifestReady(input.manifest);
  } catch (error) {
    const reasons =
      error instanceof LegacyRetirementGateError
        ? error.reasons
        : [error instanceof Error ? error.message : 'gate-failed'];
    const body = {
      contract: LEGACY_RETIREMENT_REMOVAL_RECEIPT_CONTRACT as typeof LEGACY_RETIREMENT_REMOVAL_RECEIPT_CONTRACT,
      receiptId: input.receiptId,
      retirementId: input.manifest.retirementId,
      manifestDigest: input.manifest.manifestDigest,
      removedDependencies: [] as RetireableRuntimeDependency[],
      removedAt: input.removedAt,
      status: 'blocked' as const,
      reasons,
    };
    return { ...body, receiptDigest: retirementDigest(body) };
  }

  const removedDependencies = [
    ...(input.dependencies ?? RETIREABLE_RUNTIME_DEPENDENCIES),
  ].sort() as RetireableRuntimeDependency[];

  const body = {
    contract: LEGACY_RETIREMENT_REMOVAL_RECEIPT_CONTRACT as typeof LEGACY_RETIREMENT_REMOVAL_RECEIPT_CONTRACT,
    receiptId: input.receiptId,
    retirementId: input.manifest.retirementId,
    manifestDigest: input.manifest.manifestDigest,
    removedDependencies,
    removedAt: input.removedAt,
    status: 'removed' as const,
    reasons: [] as string[],
  };
  return { ...body, receiptDigest: retirementDigest(body) };
}

/** Strict helpers used by tests and preflight scripts. */
export function requireReadyRetirementEvidence(input: {
  inventory: RetirementConsumerInventory;
  oldIdScan: OldIdScanReport;
  fallbackExport: FallbackTelemetryExport;
  archive: RetirementArchive;
  upgradeReceipt: IncrementalUpgradeReceipt;
  activationIdentities: readonly ActivationIdentityEvidence[];
}): void {
  assertZeroOldIdViolations(input.oldIdScan);
  assertZeroFallbackHits(input.fallbackExport);
  assertActivationIdentitiesReady(input.activationIdentities);
  assertIncrementalUpgradeComplete(input.upgradeReceipt);
  if (!isSha256Hex(input.inventory.inventoryDigest)) {
    throw new LegacyRetirementGateError(
      'inventory-digest-invalid',
      'inventory digest missing',
    );
  }
  if (!isSha256Hex(input.archive.archiveDigest)) {
    throw new LegacyRetirementGateError(
      'archive-digest-invalid',
      'archive digest missing',
    );
  }
}
