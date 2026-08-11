/**
 * Engineering Graph / Engineering RAG consumers of the active Authority
 * Snapshot (#1266). Teaching selectors remain independent.
 *
 * When a versioned consumer-activation pointer is present (#1276), each
 * engineering consumer reads the Authority combination selected for that
 * consumer (possibly a pinned prior snapshot) instead of always following the
 * global Authority current.json.
 */

import path from 'node:path';

import {
  resolveEngineeringGraphProductionSelection,
  resolveEngineeringRagProductionSelection,
  type ConsumerProductionSelection,
} from '@/lib/versioned-knowledge-activation';

import {
  authoritySnapshotToRepositoryView,
  DEFAULT_AUTHORITY_ROOT_RELATIVE,
  emptyTeachingSelectorFingerprint,
  type AuthorityEngineeringBody,
  type AuthoritySnapshotManifest,
  type TeachingSelectorFingerprint,
} from './authority-snapshot';
import {
  activateAuthoritySnapshot,
  loadStagedAuthoritySnapshot,
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

function resolveConfiguredAuthorityRoot(repoRoot = process.cwd()): string {
  const fromEnv =
    process.env.ACT_AUTHORITY_STORE_ROOT?.trim()
    || process.env.AUTHORITY_STORE_ROOT?.trim();
  return path.resolve(fromEnv ?? path.join(repoRoot, DEFAULT_AUTHORITY_ROOT_RELATIVE));
}

function usesDefaultAuthorityStore(
  paths: AuthorityStorePaths,
  repoRoot = process.cwd(),
): boolean {
  // An injected/staged Authority store is an isolated test or repository
  // boundary. It must not inherit the consumer pointer from the default ACT
  // root, whose combination may reference unrelated snapshot files.
  return path.resolve(paths.root) === resolveConfiguredAuthorityRoot(repoRoot);
}

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
  /** How the Authority combination was selected (#1276). */
  activationMode?: ConsumerProductionSelection['mode'];
}

function unavailableEngineering(
  consumerId: EngineeringAuthorityConsumerId,
  reason: string,
  activationMode?: ConsumerProductionSelection['mode'],
): EngineeringAuthorityResolveResult {
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
    reason,
    activationMode,
  };
}

function readyFromSnapshot(
  consumerId: EngineeringAuthorityConsumerId,
  snapshot: {
    snapshotId: string;
    snapshotHash: string;
    manifest: AuthoritySnapshotManifest;
    engineering: AuthorityEngineeringBody;
  },
  activationMode: ConsumerProductionSelection['mode'],
  reason?: string,
): EngineeringAuthorityResolveResult {
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
    reason,
    activationMode,
  };
}

function resolveViaConsumerActivation(
  paths: AuthorityStorePaths,
  consumerId: EngineeringAuthorityConsumerId,
  selection: ConsumerProductionSelection,
): EngineeringAuthorityResolveResult | null {
  if (selection.mode === 'absent') {
    // No consumer-activation pointer — keep legacy global Authority pointer.
    return null;
  }

  if (selection.mode === 'unavailable') {
    return unavailableEngineering(
      consumerId,
      selection.reasons.join('; ') || 'consumer-activation-unavailable',
      selection.mode,
    );
  }

  const combination = selection.combination;
  if (!combination?.authoritySnapshotId) {
    return unavailableEngineering(
      consumerId,
      'consumer-activation-missing-authority-snapshot',
      selection.mode,
    );
  }

  try {
    const snapshot = loadStagedAuthoritySnapshot(
      paths,
      combination.authoritySnapshotId,
    );
    if (
      combination.authoritySnapshotHash
      && snapshot.snapshotHash !== combination.authoritySnapshotHash
    ) {
      return unavailableEngineering(
        consumerId,
        'consumer-activation-authority-hash-mismatch',
        selection.mode,
      );
    }
    if (
      combination.authorityReleaseId
      && snapshot.manifest.releaseId !== combination.authorityReleaseId
    ) {
      return unavailableEngineering(
        consumerId,
        'consumer-activation-authority-release-mismatch',
        selection.mode,
      );
    }
    return readyFromSnapshot(
      consumerId,
      snapshot,
      selection.mode,
      selection.mode === 'pin-combination'
        ? 'consumer-activation-pinned-authority'
        : 'consumer-activation-selected-authority',
    );
  } catch (error) {
    return unavailableEngineering(
      consumerId,
      error instanceof Error
        ? `consumer-activation-authority-load-failed:${error.message}`
        : 'consumer-activation-authority-load-failed',
      selection.mode,
    );
  }
}

/**
 * Resolve the active Authority Snapshot for an engineering-only consumer.
 * The configured default Authority store prefers the per-consumer activation
 * combination (#1276) when present; isolated stores fall back to their own
 * global Authority current pointer. Fail closed on mismatch.
 */
export function resolveEngineeringAuthorityConsumer(
  paths: AuthorityStorePaths,
  consumerId: EngineeringAuthorityConsumerId,
  options: {
    repoRoot?: string;
    /** Injected for tests; production reads the configured activation root. */
    activationSelection?: ConsumerProductionSelection;
  } = {},
): EngineeringAuthorityResolveResult {
  const selection = options.activationSelection
    ?? (usesDefaultAuthorityStore(paths, options.repoRoot)
      ? consumerId === 'engineering-graph'
        ? resolveEngineeringGraphProductionSelection({ repoRoot: options.repoRoot })
        : resolveEngineeringRagProductionSelection({ repoRoot: options.repoRoot })
      : null);

  if (selection) {
    const fromActivation = resolveViaConsumerActivation(
      paths,
      consumerId,
      selection,
    );
    if (fromActivation) return fromActivation;
  }

  const resolved = resolveActiveAuthoritySnapshot(paths);
  if (resolved.status !== 'available') {
    return unavailableEngineering(
      consumerId,
      resolved.detail ?? 'authority-unavailable',
      'absent',
    );
  }

  return readyFromSnapshot(
    consumerId,
    resolved.snapshot,
    'absent',
    'global-authority-current-pointer',
  );
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
/**
 * Import-path gate: only ACCEPTED ReleaseSet Delta receipts may produce a
 * staged Authority Snapshot eligible for later activation (#1266 review).
 */
export function shouldStageAuthorityAfterDelta(authorizationState: string): boolean {
  return authorizationState === 'ACCEPTED';
}

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
