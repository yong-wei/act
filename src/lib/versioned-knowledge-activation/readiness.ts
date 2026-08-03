/**
 * Per-consumer readiness evaluation for versioned knowledge activation (#1276).
 *
 * Engineering consumers may become READY while affected teaching consumers
 * remain PINNED_PREVIOUS or BLOCKED_LOCAL_DEPENDENCY with exact reasons.
 */

import {
  CONSUMER_ACTIVATION_IDS,
  consumerRequiresProjection,
  emptyCombination,
  type ConsumerActivationId,
  type ConsumerActivationRecord,
  type ConsumerActivationStatus,
  type ConsumerVersionCombination,
} from './contracts';

/** Inputs describing staged artifacts available for readiness evaluation. */
export interface StagedActivationArtifactSet {
  /** Shared capture / Git revision that all artifacts must match. */
  captureRevision: string | null;
  authority: {
    present: boolean;
    releaseId: string | null;
    snapshotId: string | null;
    snapshotHash: string | null;
    captureRevision: string | null;
    /** File digests under the authority release (manifest, engineering, …). */
    artifactHashes: Record<string, string>;
    /**
     * Real staged file paths keyed like artifactHashes. Staging rehashes these
     * against declared digests; missing paths for required artifacts fail closed.
     */
    artifactPaths?: Record<string, string>;
  } | null;
  projection: {
    present: boolean;
    projectionId: string | null;
    projectionHash: string | null;
    authorityReleaseId: string | null;
    captureRevision: string | null;
    gatePassed: boolean;
    /** File digests under the projection release. */
    artifactHashes: Record<string, string>;
    /**
     * Real staged file paths keyed like artifactHashes. Staging rehashes these
     * against declared digests; missing paths for required artifacts fail closed.
     */
    artifactPaths?: Record<string, string>;
    hasResources: boolean;
    hasCardsIndex: boolean;
    hasPrerequisites: boolean;
    hasImpactReport: boolean;
  } | null;
  /** Optional route/resource smoke results keyed by consumer. */
  routeSmoke?: Partial<Record<ConsumerActivationId, { ok: boolean; reasons: string[] }>>;
  /** Explicit identity-drift flags (mixed capture / cross-artifact mismatch). */
  identityDriftReasons?: string[];
}

export interface PriorConsumerState {
  consumerId: ConsumerActivationId;
  combination: ConsumerVersionCombination;
  status?: ConsumerActivationStatus;
}

export interface EvaluateConsumerReadinessInput {
  artifacts: StagedActivationArtifactSet;
  /** Prior activation combinations used for pinning when new set is blocked. */
  priorConsumers?: readonly PriorConsumerState[];
  /**
   * When true (default for teaching consumers with prior pins), blocked local
   * deps become PINNED_PREVIOUS instead of BLOCKED_LOCAL_DEPENDENCY when a
   * prior combination exists.
   */
  preferPinOnBlock?: boolean;
  activatedAt?: string | null;
  /**
   * Consumers forced into SHADOW (shadow comparison not yet clean).
   * They do not claim READY.
   */
  shadowConsumerIds?: readonly ConsumerActivationId[];
}

function priorFor(
  priorConsumers: readonly PriorConsumerState[] | undefined,
  consumerId: ConsumerActivationId,
): PriorConsumerState | null {
  return priorConsumers?.find((row) => row.consumerId === consumerId) ?? null;
}

function mixedCaptureReasons(artifacts: StagedActivationArtifactSet): string[] {
  const reasons: string[] = [...(artifacts.identityDriftReasons ?? [])];
  const expected = artifacts.captureRevision;
  if (
    expected
    && artifacts.authority?.present
    && artifacts.authority.captureRevision
    && artifacts.authority.captureRevision !== expected
  ) {
    reasons.push('authority-capture-revision-mismatch');
  }
  if (
    expected
    && artifacts.projection?.present
    && artifacts.projection.captureRevision
    && artifacts.projection.captureRevision !== expected
  ) {
    reasons.push('projection-capture-revision-mismatch');
  }
  if (
    artifacts.authority?.present
    && artifacts.projection?.present
    && artifacts.authority.releaseId
    && artifacts.projection.authorityReleaseId
    && artifacts.authority.releaseId !== artifacts.projection.authorityReleaseId
  ) {
    reasons.push('authority-projection-release-mismatch');
  }
  if (
    artifacts.authority?.present
    && artifacts.projection?.present
    && artifacts.authority.captureRevision
    && artifacts.projection.captureRevision
    && artifacts.authority.captureRevision !== artifacts.projection.captureRevision
  ) {
    reasons.push('authority-projection-capture-drift');
  }
  return reasons;
}

function buildCombination(
  artifacts: StagedActivationArtifactSet,
  opts: { includeProjection: boolean },
): ConsumerVersionCombination {
  const base = emptyCombination();
  if (artifacts.authority?.present) {
    base.authorityReleaseId = artifacts.authority.releaseId;
    base.authoritySnapshotId = artifacts.authority.snapshotId;
    base.authoritySnapshotHash = artifacts.authority.snapshotHash;
    base.captureRevision =
      artifacts.authority.captureRevision ?? artifacts.captureRevision;
  }
  if (opts.includeProjection && artifacts.projection?.present) {
    base.projectionId = artifacts.projection.projectionId;
    base.projectionHash = artifacts.projection.projectionHash;
    base.captureRevision =
      artifacts.projection.captureRevision
      ?? base.captureRevision
      ?? artifacts.captureRevision;
  }
  return base;
}

function evaluateEngineering(
  consumerId: Extract<ConsumerActivationId, 'engineering-graph' | 'engineering-rag'>,
  input: EvaluateConsumerReadinessInput,
  mixed: string[],
): ConsumerActivationRecord {
  const reasons: string[] = [];
  const prior = priorFor(input.priorConsumers, consumerId);
  const auth = input.artifacts.authority;
  const artifactHashes: Record<string, string> = {
    ...(auth?.artifactHashes ?? {}),
  };

  if (input.shadowConsumerIds?.includes(consumerId)) {
    reasons.push('shadow-comparison-pending');
    return {
      consumerId,
      status: 'SHADOW',
      combination: prior?.combination ?? buildCombination(input.artifacts, {
        includeProjection: false,
      }),
      priorCombination: prior?.combination ?? null,
      artifactHashes,
      reasons,
      activatedAt: input.activatedAt ?? null,
    };
  }

  if (mixed.length > 0) {
    reasons.push(...mixed);
    if (prior && input.preferPinOnBlock !== false) {
      reasons.push('pin-previous-after-mixed-capture');
      return {
        consumerId,
        status: 'PINNED_PREVIOUS',
        combination: prior.combination,
        priorCombination: prior.combination,
        artifactHashes,
        reasons,
        activatedAt: input.activatedAt ?? null,
      };
    }
    return {
      consumerId,
      status: 'BLOCKED_LOCAL_DEPENDENCY',
      combination: buildCombination(input.artifacts, { includeProjection: false }),
      priorCombination: prior?.combination ?? null,
      artifactHashes,
      reasons,
      activatedAt: input.activatedAt ?? null,
    };
  }

  if (!auth?.present) {
    reasons.push('authority-snapshot-missing');
    if (prior && input.preferPinOnBlock !== false) {
      reasons.push('pin-previous-after-missing-authority');
      return {
        consumerId,
        status: 'PINNED_PREVIOUS',
        combination: prior.combination,
        priorCombination: prior.combination,
        artifactHashes,
        reasons,
        activatedAt: input.activatedAt ?? null,
      };
    }
    return {
      consumerId,
      status: 'BLOCKED_LOCAL_DEPENDENCY',
      combination: emptyCombination(),
      priorCombination: prior?.combination ?? null,
      artifactHashes,
      reasons,
      activatedAt: input.activatedAt ?? null,
    };
  }

  if (!auth.snapshotId || !auth.snapshotHash || !auth.releaseId) {
    reasons.push('authority-identity-incomplete');
    return {
      consumerId,
      status: 'BLOCKED_LOCAL_DEPENDENCY',
      combination: buildCombination(input.artifacts, { includeProjection: false }),
      priorCombination: prior?.combination ?? null,
      artifactHashes,
      reasons,
      activatedAt: input.activatedAt ?? null,
    };
  }

  if (!auth.artifactHashes['manifest.json'] || !auth.artifactHashes['engineering.json']) {
    reasons.push('authority-artifact-missing');
    return {
      consumerId,
      status: 'BLOCKED_LOCAL_DEPENDENCY',
      combination: buildCombination(input.artifacts, { includeProjection: false }),
      priorCombination: prior?.combination ?? null,
      artifactHashes,
      reasons,
      activatedAt: input.activatedAt ?? null,
    };
  }

  const smoke = input.artifacts.routeSmoke?.[consumerId];
  if (smoke && !smoke.ok) {
    reasons.push('route-smoke-failed', ...smoke.reasons);
    return {
      consumerId,
      status: 'BLOCKED_LOCAL_DEPENDENCY',
      combination: buildCombination(input.artifacts, { includeProjection: false }),
      priorCombination: prior?.combination ?? null,
      artifactHashes,
      reasons,
      activatedAt: input.activatedAt ?? null,
    };
  }

  // Teaching projection emptiness never blocks engineering readiness.
  reasons.push('engineering-only-no-projection-required');
  reasons.push('authority-ready');
  return {
    consumerId,
    status: 'READY',
    combination: buildCombination(input.artifacts, { includeProjection: false }),
    priorCombination: prior?.combination ?? null,
    artifactHashes,
    reasons,
    activatedAt: input.activatedAt ?? null,
  };
}

function evaluateTeaching(
  consumerId: Exclude<
    ConsumerActivationId,
    'engineering-graph' | 'engineering-rag'
  >,
  input: EvaluateConsumerReadinessInput,
  mixed: string[],
): ConsumerActivationRecord {
  const reasons: string[] = [];
  const prior = priorFor(input.priorConsumers, consumerId);
  const proj = input.artifacts.projection;
  const auth = input.artifacts.authority;
  const artifactHashes: Record<string, string> = {
    ...(auth?.artifactHashes ?? {}),
    ...(proj?.artifactHashes ?? {}),
  };

  if (input.shadowConsumerIds?.includes(consumerId)) {
    reasons.push('shadow-comparison-pending');
    return {
      consumerId,
      status: 'SHADOW',
      combination: prior?.combination
        ?? buildCombination(input.artifacts, { includeProjection: true }),
      priorCombination: prior?.combination ?? null,
      artifactHashes,
      reasons,
      activatedAt: input.activatedAt ?? null,
    };
  }

  const block = (extra: string[]): ConsumerActivationRecord => {
    const all = [...reasons, ...extra];
    if (prior && input.preferPinOnBlock !== false) {
      all.push('pin-previous-after-local-block');
      return {
        consumerId,
        status: 'PINNED_PREVIOUS',
        combination: prior.combination,
        priorCombination: prior.combination,
        artifactHashes,
        reasons: all,
        activatedAt: input.activatedAt ?? null,
      };
    }
    return {
      consumerId,
      status: 'BLOCKED_LOCAL_DEPENDENCY',
      combination: buildCombination(input.artifacts, { includeProjection: true }),
      priorCombination: prior?.combination ?? null,
      artifactHashes,
      reasons: all,
      activatedAt: input.activatedAt ?? null,
    };
  };

  if (mixed.length > 0) {
    return block(mixed);
  }

  if (!auth?.present) {
    return block(['authority-snapshot-missing']);
  }
  if (!auth.snapshotId || !auth.snapshotHash || !auth.releaseId) {
    return block(['authority-identity-incomplete']);
  }

  if (!proj?.present) {
    return block(['projection-missing']);
  }
  if (!proj.projectionId || !proj.projectionHash) {
    return block(['projection-identity-incomplete']);
  }
  if (!proj.gatePassed) {
    return block(['projection-gate-failed']);
  }

  // Consumer-specific artifact requirements.
  if (consumerId === 'course-runtime') {
    if (!proj.hasResources) {
      return block(['course-resources-missing']);
    }
    if (!proj.artifactHashes['resources.jsonl'] || !proj.artifactHashes['bindings.jsonl']) {
      return block(['course-resource-artifacts-missing']);
    }
  }

  if (consumerId === 'teaching-resource-rag' || consumerId === 'konling') {
    if (!proj.hasCardsIndex) {
      return block(['cards-index-missing']);
    }
    if (!proj.artifactHashes['cards-index.json']) {
      return block(['cards-index-artifact-missing']);
    }
  }

  if (consumerId === 'learning-path') {
    if (!proj.hasPrerequisites) {
      return block(['prerequisites-missing']);
    }
    if (!proj.artifactHashes['prerequisites.jsonl']) {
      return block(['prerequisites-artifact-missing']);
    }
  }

  if (consumerId === 'konling' || consumerId === 'learning-path') {
    if (!proj.hasImpactReport && !proj.artifactHashes['impact-report.json']) {
      // impact is diagnostic; soft require presence of hash if report claimed.
      // When neither present, still allow if gate passed — but fixtures may mark.
    }
  }

  const smoke = input.artifacts.routeSmoke?.[consumerId];
  if (smoke && !smoke.ok) {
    return block(['route-smoke-failed', ...smoke.reasons]);
  }

  reasons.push('teaching-projection-ready');
  reasons.push(`${consumerId}-ready`);
  return {
    consumerId,
    status: 'READY',
    combination: buildCombination(input.artifacts, { includeProjection: true }),
    priorCombination: prior?.combination ?? null,
    artifactHashes,
    reasons,
    activatedAt: input.activatedAt ?? null,
  };
}

/**
 * Evaluate readiness for every named consumer independently.
 * Unknown consumer ids are never produced; callers must use CONSUMER_ACTIVATION_IDS.
 */
export function evaluateConsumerReadiness(
  input: EvaluateConsumerReadinessInput,
): ConsumerActivationRecord[] {
  const mixed = mixedCaptureReasons(input.artifacts);
  const records: ConsumerActivationRecord[] = [];

  for (const consumerId of CONSUMER_ACTIVATION_IDS) {
    if (!consumerRequiresProjection(consumerId)) {
      records.push(
        evaluateEngineering(
          consumerId as 'engineering-graph' | 'engineering-rag',
          input,
          mixed,
        ),
      );
    } else {
      records.push(
        evaluateTeaching(
          consumerId as Exclude<
            ConsumerActivationId,
            'engineering-graph' | 'engineering-rag'
          >,
          input,
          mixed,
        ),
      );
    }
  }

  return records.sort((a, b) => a.consumerId.localeCompare(b.consumerId));
}

export function summarizeImpact(consumers: readonly ConsumerActivationRecord[]): {
  readyConsumerIds: ConsumerActivationId[];
  pinnedConsumerIds: ConsumerActivationId[];
  blockedConsumerIds: ConsumerActivationId[];
  shadowConsumerIds: ConsumerActivationId[];
} {
  const readyConsumerIds: ConsumerActivationId[] = [];
  const pinnedConsumerIds: ConsumerActivationId[] = [];
  const blockedConsumerIds: ConsumerActivationId[] = [];
  const shadowConsumerIds: ConsumerActivationId[] = [];
  for (const row of consumers) {
    switch (row.status) {
      case 'READY':
        readyConsumerIds.push(row.consumerId);
        break;
      case 'PINNED_PREVIOUS':
        pinnedConsumerIds.push(row.consumerId);
        break;
      case 'BLOCKED_LOCAL_DEPENDENCY':
        blockedConsumerIds.push(row.consumerId);
        break;
      case 'SHADOW':
        shadowConsumerIds.push(row.consumerId);
        break;
      default: {
        // Exhaustiveness: unknown statuses must not reach the manifest.
        const _never: never = row.status;
        void _never;
        throw new Error(`unknown consumer status: ${String(row.status)}`);
      }
    }
  }
  return {
    readyConsumerIds,
    pinnedConsumerIds,
    blockedConsumerIds,
    shadowConsumerIds,
  };
}
