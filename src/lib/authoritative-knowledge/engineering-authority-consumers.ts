/**
 * Engineering Graph / Engineering RAG consumers of the active Authority
 * Snapshot (#1266). Teaching selectors remain independent.
 */

import {
  authoritySnapshotToRepositoryView,
  emptyTeachingSelectorFingerprint,
  type AuthorityEngineeringBody,
  type AuthoritySnapshotManifest,
  type TeachingSelectorFingerprint,
} from './authority-snapshot';
import {
  activateAuthoritySnapshot,
  resolveActiveAuthoritySnapshot,
  stageAuthoritySnapshot,
  type ActivateAuthoritySnapshotResult,
  type AuthorityStorePaths,
  type StagedAuthoritySnapshotFiles,
} from './authority-store';
import type {
  AuthoritativeKnowledgeSnapshot,
  AuthoritySelector,
  RepositoryResult,
} from './contracts';
import type { MaterializeAuthoritySnapshotInput } from './authority-snapshot';

export type EngineeringAuthorityConsumerId =
  | 'engineering-graph'
  | 'engineering-rag';

export interface EngineeringAuthorityResolveResult {
  status: 'ready' | 'unavailable';
  consumerId: EngineeringAuthorityConsumerId;
  snapshotId: string | null;
  snapshotHash: string | null;
  releaseId: string | null;
  releaseSetId: string | null;
  objectCount: number;
  relationCount: number;
  engineering: AuthorityEngineeringBody | null;
  manifest: AuthoritySnapshotManifest | null;
  /** Teaching projection emptiness never blocks engineering readiness. */
  teachingProjectionRequired: false;
  reason?: string;
}

/**
 * Resolve the active Authority Snapshot for an engineering-only consumer.
 * Fail closed when the pointer is missing or digest-mismatched.
 */
export function resolveEngineeringAuthorityConsumer(
  paths: AuthorityStorePaths,
  consumerId: EngineeringAuthorityConsumerId,
): EngineeringAuthorityResolveResult {
  const resolved = resolveActiveAuthoritySnapshot(paths);
  if (resolved.status !== 'available') {
    return {
      status: 'unavailable',
      consumerId,
      snapshotId: null,
      snapshotHash: null,
      releaseId: null,
      releaseSetId: null,
      objectCount: 0,
      relationCount: 0,
      engineering: null,
      manifest: null,
      teachingProjectionRequired: false,
      reason: resolved.detail,
    };
  }

  const { snapshot } = resolved;
  return {
    status: 'ready',
    consumerId,
    snapshotId: snapshot.snapshotId,
    snapshotHash: snapshot.snapshotHash,
    releaseId: snapshot.manifest.releaseId,
    releaseSetId: snapshot.manifest.releaseSetId,
    objectCount: snapshot.manifest.objectCount,
    relationCount: snapshot.manifest.relationCount,
    engineering: snapshot.engineering,
    manifest: snapshot.manifest,
    teachingProjectionRequired: false,
  };
}

export function resolveEngineeringGraphAuthority(
  paths: AuthorityStorePaths,
): EngineeringAuthorityResolveResult {
  return resolveEngineeringAuthorityConsumer(paths, 'engineering-graph');
}

export function resolveEngineeringRagAuthority(
  paths: AuthorityStorePaths,
): EngineeringAuthorityResolveResult {
  return resolveEngineeringAuthorityConsumer(paths, 'engineering-rag');
}

/**
 * Stage from a Repository candidate snapshot without activation.
 * Import/stage remains selector-neutral.
 */
export function stageAuthorityFromRepositorySnapshot(
  paths: AuthorityStorePaths,
  input: MaterializeAuthoritySnapshotInput,
): StagedAuthoritySnapshotFiles {
  return stageAuthoritySnapshot(paths, input);
}

/**
 * Post-import helper used by the standard Bundle import path after DB import,
 * Repository validation, and Delta binding succeed. Stages a complete immutable
 * Authority Snapshot under authority/releases/<snapshotId> and never activates
 * the current Authority pointer as a side effect of import.
 */
export function stageAuthorityAfterValidatedBundleImport(input: {
  paths: AuthorityStorePaths;
  repositorySnapshot: AuthoritativeKnowledgeSnapshot;
  deltaReceiptIds?: readonly string[];
  predecessorReleaseId?: string | null;
  captureRevision?: string | null;
  stagedAt?: string;
  receiptId?: string;
}): StagedAuthoritySnapshotFiles {
  return stageAuthoritySnapshot(
    input.paths,
    {
      snapshot: input.repositorySnapshot,
      deltaReceiptIds: input.deltaReceiptIds,
      predecessorReleaseId: input.predecessorReleaseId,
      captureRevision: input.captureRevision,
      stagedAt: input.stagedAt,
    },
    {
      stagedAt: input.stagedAt,
      receiptId: input.receiptId,
    },
  );
}

/**
 * Activate a staged snapshot for engineering consumers only.
 * Proves teaching selectors are unchanged by requiring equal fingerprints.
 */
export function activateEngineeringAuthority(
  paths: AuthorityStorePaths,
  input: {
    snapshotId: string;
    teachingSelectors?: TeachingSelectorFingerprint;
    activatedAt?: string;
    activationReceiptId?: string;
  },
): ActivateAuthoritySnapshotResult {
  return activateAuthoritySnapshot(paths, {
    snapshotId: input.snapshotId,
    teachingSelectors: input.teachingSelectors ?? emptyTeachingSelectorFingerprint(),
    activatedAt: input.activatedAt,
    activationReceiptId: input.activationReceiptId,
  });
}

/**
 * Build a RepositoryResult for the active Authority pointer. Used by
 * AuthoritativeKnowledgeRepository.read({ authorityState: 'active' }).
 */
export function readActiveAuthorityRepositoryResult(
  paths: AuthorityStorePaths,
): RepositoryResult {
  const selector: Extract<AuthoritySelector, { authorityState: 'active' }> = {
    authorityState: 'active',
  };
  const resolved = resolveActiveAuthoritySnapshot(paths);
  if (resolved.status !== 'available') {
    return {
      status: 'unavailable',
      selector,
      reason: 'active-pointer-unavailable',
      diagnostics: [],
    };
  }

  const snapshot: AuthoritativeKnowledgeSnapshot = authoritySnapshotToRepositoryView({
    manifest: resolved.snapshot.manifest,
    engineering: resolved.snapshot.engineering,
    authorityState: 'active',
  });

  return {
    status: 'available',
    selector,
    snapshot,
    diagnostics: [],
  };
}

/**
 * Prove activation with empty/unresolved Teaching Projection leaves course,
 * KAQ, path, and teaching selectors unchanged while engineering consumers
 * advance.
 */
export function proveEmptyTeachingProjectionActivation(input: {
  paths: AuthorityStorePaths;
  repositorySnapshot: AuthoritativeKnowledgeSnapshot;
  teachingSelectors: TeachingSelectorFingerprint;
  deltaReceiptIds?: readonly string[];
}): {
  staged: StagedAuthoritySnapshotFiles;
  activation: ActivateAuthoritySnapshotResult;
  engineeringGraph: EngineeringAuthorityResolveResult;
  engineeringRag: EngineeringAuthorityResolveResult;
  teachingSelectorsUnchanged: boolean;
  teachingSelectorsAfter: TeachingSelectorFingerprint;
} {
  const staged = stageAuthorityFromRepositorySnapshot(input.paths, {
    snapshot: input.repositorySnapshot,
    deltaReceiptIds: input.deltaReceiptIds,
  });
  const activation = activateEngineeringAuthority(input.paths, {
    snapshotId: staged.snapshotId,
    teachingSelectors: input.teachingSelectors,
  });
  const teachingSelectorsAfter = input.teachingSelectors;
  return {
    staged,
    activation,
    engineeringGraph: resolveEngineeringGraphAuthority(input.paths),
    engineeringRag: resolveEngineeringRagAuthority(input.paths),
    teachingSelectorsUnchanged:
      activation.status === 'activated'
      && activation.receipt.teachingSelectorsAdvanced === false
      && JSON.stringify(activation.receipt.teachingSelectorFingerprintBefore)
        === JSON.stringify(activation.receipt.teachingSelectorFingerprintAfter),
    teachingSelectorsAfter,
  };
}
