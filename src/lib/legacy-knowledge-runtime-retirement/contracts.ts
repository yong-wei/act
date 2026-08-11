/**
 * Legacy knowledge runtime retirement contracts (#1277).
 *
 * Evidence-gated removal of obsolete legacy runtime dependencies.
 * Must not modify activation pointers; historical adapters/crosswalks remain.
 */

import type { ConsumerActivationId } from '@/lib/versioned-knowledge-activation/contracts';

export const LEGACY_RETIREMENT_CONTRACT =
  'act-legacy-knowledge-runtime-retirement/v1' as const;
export const LEGACY_RETIREMENT_MANIFEST_CONTRACT =
  'act-legacy-knowledge-runtime-retirement-manifest/v1' as const;
export const LEGACY_RETIREMENT_INVENTORY_CONTRACT =
  'act-legacy-knowledge-runtime-retirement-inventory/v1' as const;
export const LEGACY_RETIREMENT_OLD_ID_SCAN_CONTRACT =
  'act-legacy-knowledge-runtime-retirement-old-id-scan/v1' as const;
export const LEGACY_RETIREMENT_FALLBACK_EXPORT_CONTRACT =
  'act-legacy-knowledge-runtime-retirement-fallback-export/v1' as const;
export const LEGACY_RETIREMENT_INCREMENTAL_UPGRADE_CONTRACT =
  'act-legacy-knowledge-runtime-retirement-incremental-upgrade/v1' as const;
export const LEGACY_RETIREMENT_ARCHIVE_CONTRACT =
  'act-legacy-knowledge-runtime-retirement-archive/v1' as const;
export const LEGACY_RETIREMENT_REMOVAL_RECEIPT_CONTRACT =
  'act-legacy-knowledge-runtime-retirement-removal-receipt/v1' as const;

export const LEGACY_RETIREMENT_BUILDER_VERSION =
  'act-legacy-knowledge-runtime-retirement-builder/v1' as const;

export const DEFAULT_LEGACY_RETIREMENT_ROOT_RELATIVE =
  'course-content/runtime/knowledge/legacy-retirement' as const;

/** Dependencies removed only after the retirement gate passes. */
export const RETIREABLE_RUNTIME_DEPENDENCIES = [
  'legacy-runtime-graph-overlay-reader',
  'legacy-card-direct-reader',
  'global-course-coverage-runtime-selector',
  'production-legacy-fallback-path',
] as const;

export type RetireableRuntimeDependency =
  (typeof RETIREABLE_RUNTIME_DEPENDENCIES)[number];

export function isRetireableRuntimeDependency(
  value: unknown,
): value is RetireableRuntimeDependency {
  return (
    typeof value === 'string'
    && (RETIREABLE_RUNTIME_DEPENDENCIES as readonly string[]).includes(value)
  );
}

/** Historical paths that MUST remain after retirement. */
export const RETAINED_HISTORICAL_ARTIFACTS = [
  'legacy-course-coverage-audit-manifest',
  'old-to-canonical-crosswalk',
  'historical-authority-projection-snapshots',
  'learning-fact-revision-metadata',
  'digest-verified-rollback-archive',
  'historical-learning-fact-crosswalk-adapter',
] as const;

export type RetainedHistoricalArtifact =
  (typeof RETAINED_HISTORICAL_ARTIFACTS)[number];

export class LegacyRetirementError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LegacyRetirementError';
    this.code = code;
  }
}

export class LegacyRetirementGateError extends LegacyRetirementError {
  readonly reasons: string[];

  constructor(code: string, message: string, reasons: string[] = []) {
    super(code, message);
    this.name = 'LegacyRetirementGateError';
    this.reasons = reasons;
  }
}

export type InventoryEntryKind =
  | 'active-consumer'
  | 'legacy-reader'
  | 'selector'
  | 'fallback-counter'
  | 'historical-adapter'
  | 'rollback-artifact'
  | 'authoring-path'
  | 'runtime-path';

export interface InventoryEntry {
  id: string;
  kind: InventoryEntryKind;
  path: string | null;
  consumerId: ConsumerActivationId | string | null;
  retainedAfterRetirement: boolean;
  notes: string | null;
}

export interface RetirementConsumerInventory {
  contract: typeof LEGACY_RETIREMENT_INVENTORY_CONTRACT;
  builderVersion: typeof LEGACY_RETIREMENT_BUILDER_VERSION;
  captureRevision: string | null;
  entries: InventoryEntry[];
  inventoryDigest: string;
}

export interface OldIdScanHit {
  path: string;
  line: number | null;
  match: string;
  contentDigest: string;
}

export interface OldIdScanReport {
  contract: typeof LEGACY_RETIREMENT_OLD_ID_SCAN_CONTRACT;
  builderVersion: typeof LEGACY_RETIREMENT_BUILDER_VERSION;
  captureRevision: string | null;
  scannedRoots: string[];
  hits: OldIdScanHit[];
  hitCount: number;
  /** True only when no new-content violations exist. */
  zeroViolations: boolean;
  scanDigest: string;
}

export interface FallbackHitCount {
  consumerId: string;
  hitCount: number;
  samples: Array<{
    hitId: string | null;
    legacyId: string | null;
    recordedAt: string | null;
  }>;
}

export interface FallbackTelemetryExport {
  contract: typeof LEGACY_RETIREMENT_FALLBACK_EXPORT_CONTRACT;
  builderVersion: typeof LEGACY_RETIREMENT_BUILDER_VERSION;
  evidenceWindow: {
    startAt: string;
    endAt: string;
  };
  consumers: FallbackHitCount[];
  totalHits: number;
  zeroHits: boolean;
  exportDigest: string;
}

export interface ActivationIdentityEvidence {
  consumerId: ConsumerActivationId | string;
  status: string;
  authorityReleaseId: string | null;
  authoritySnapshotId: string | null;
  projectionId: string | null;
  projectionHash: string | null;
  /** READY under versioned combination is required for cutover consumers. */
  readyUnderVersionedCombination: boolean;
}

export interface IncrementalUpgradeReceipt {
  contract: typeof LEGACY_RETIREMENT_INCREMENTAL_UPGRADE_CONTRACT;
  receiptId: string;
  deltaIdentity: string;
  deltaOutputDigest: string;
  impactCompleted: boolean;
  projectionRebuildCompleted: boolean;
  consumerActivationCompleted: boolean;
  rollbackEvidenceCompleted: boolean;
  /** Digest of the archived rollback target. */
  rollbackArchiveDigest: string | null;
  completedAt: string;
  reasons: string[];
  receiptDigest: string;
}

export interface RetirementArchiveEntry {
  artifactId: RetainedHistoricalArtifact | string;
  path: string | null;
  contentDigest: string;
  immutable: true;
}

export interface RetirementArchive {
  contract: typeof LEGACY_RETIREMENT_ARCHIVE_CONTRACT;
  builderVersion: typeof LEGACY_RETIREMENT_BUILDER_VERSION;
  captureRevision: string | null;
  /** Frozen 34-batch / 4,891-member audit digest. */
  legacyAuditManifestDigest: string;
  entries: RetirementArchiveEntry[];
  archiveDigest: string;
}

export interface RemovedDependencyRecord {
  dependencyId: RetireableRuntimeDependency;
  removed: boolean;
  reason: string;
  retainedHistoricalAdapter: string | null;
}

/**
 * Immutable retirement manifest. Missing evidence fails closed.
 * Must NOT encode activation pointer mutations.
 */
export interface RetirementManifest {
  contract: typeof LEGACY_RETIREMENT_MANIFEST_CONTRACT;
  builderVersion: typeof LEGACY_RETIREMENT_BUILDER_VERSION;
  retirementId: string;
  captureRevision: string | null;
  headRevision: string | null;
  reviewedAt: string | null;
  inventoryDigest: string;
  oldIdScanDigest: string;
  fallbackExportDigest: string;
  archiveDigest: string;
  incrementalUpgradeReceiptDigest: string;
  activationIdentities: ActivationIdentityEvidence[];
  removedDependencies: RemovedDependencyRecord[];
  /** Explicit non-goals encoded as invariants. */
  invariants: {
    doesNotModifyActivationPointers: true;
    doesNotDeleteHistoricalEvidence: true;
    doesNotDeployRemotely: true;
    doesNotIncludePrismaMigration: true;
    doesNotIncludeUpstreamSemanticReview: true;
    failClosedOnMissingEvidence: true;
  };
  status: 'blocked' | 'ready-for-removal' | 'removed';
  reasons: string[];
  manifestDigest: string;
}

export interface RemovalReceipt {
  contract: typeof LEGACY_RETIREMENT_REMOVAL_RECEIPT_CONTRACT;
  receiptId: string;
  retirementId: string;
  manifestDigest: string;
  removedDependencies: RetireableRuntimeDependency[];
  removedAt: string;
  status: 'removed' | 'blocked' | 'failed';
  reasons: string[];
  receiptDigest: string;
}

/** Change-diff surface used to detect illegal activation coupling. */
export interface RetirementChangeSurface {
  modifiesActivationPointers: boolean;
  removesLegacyReaders: boolean;
  touchesRemoteDeployment: boolean;
  includesPrismaMigration: boolean;
  includesUpstreamSemanticReview: boolean;
  paths: string[];
}
