/**
 * Consumer wiring: resolve the active Authority/Projection combination for a
 * named consumer from the activation pointer (#1276).
 *
 * Fail closed on missing pointer, unknown status, or blocked consumers that
 * claim to be active.
 */

import path from 'node:path';

import {
  DEFAULT_CONSUMER_ACTIVATION_ROOT_RELATIVE,
  isConsumerActivationId,
  isConsumerActivationStatus,
  type ConsumerActivationId,
  type ConsumerActivationManifest,
  type ConsumerActivationRecord,
  type ConsumerActivationStatus,
  type ConsumerVersionCombination,
} from './contracts';
import {
  resolveActiveConsumerActivation,
  resolveConsumerActivationStorePaths,
  type ConsumerActivationStorePaths,
} from './store';

export function resolveConfiguredConsumerActivationRoot(
  repoRoot = process.cwd(),
): string {
  const fromEnv =
    process.env.ACT_CONSUMER_ACTIVATION_ROOT?.trim()
    || process.env.CONSUMER_ACTIVATION_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(repoRoot, DEFAULT_CONSUMER_ACTIVATION_ROOT_RELATIVE);
}

export function resolveDefaultConsumerActivationStorePaths(
  repoRoot = process.cwd(),
): ConsumerActivationStorePaths {
  return resolveConsumerActivationStorePaths(
    resolveConfiguredConsumerActivationRoot(repoRoot),
  );
}

export interface ResolvedConsumerActivation {
  status: 'ready' | 'pinned' | 'shadow' | 'blocked' | 'unavailable';
  /** Known consumer id, or the raw requested id when unknown. */
  consumerId: ConsumerActivationId | string;
  activationId: string | null;
  activationHash: string | null;
  consumerStatus: ConsumerActivationStatus | null;
  combination: ConsumerVersionCombination | null;
  priorCombination: ConsumerVersionCombination | null;
  reasons: string[];
  record: ConsumerActivationRecord | null;
  manifest: ConsumerActivationManifest | null;
}

function mapStatus(
  consumerStatus: ConsumerActivationStatus,
): ResolvedConsumerActivation['status'] {
  switch (consumerStatus) {
    case 'READY':
      return 'ready';
    case 'PINNED_PREVIOUS':
      return 'pinned';
    case 'SHADOW':
      return 'shadow';
    case 'BLOCKED_LOCAL_DEPENDENCY':
      return 'blocked';
    default: {
      const _never: never = consumerStatus;
      void _never;
      return 'unavailable';
    }
  }
}

/**
 * Resolve one consumer's active combination from the activation store.
 * Unknown consumer ids and unknown statuses fail closed.
 */
export function resolveConsumerActivation(
  paths: ConsumerActivationStorePaths,
  consumerId: string,
): ResolvedConsumerActivation {
  if (!isConsumerActivationId(consumerId)) {
    return {
      status: 'unavailable',
      consumerId,
      activationId: null,
      activationHash: null,
      consumerStatus: null,
      combination: null,
      priorCombination: null,
      reasons: [`unknown-consumer-id:${consumerId}`],
      record: null,
      manifest: null,
    };
  }

  const resolved = resolveActiveConsumerActivation(paths);
  if (resolved.status !== 'available' || !resolved.manifest) {
    return {
      status: 'unavailable',
      consumerId,
      activationId: resolved.pointer?.activationId ?? null,
      activationHash: resolved.pointer?.activationHash ?? null,
      consumerStatus: null,
      combination: null,
      priorCombination: null,
      reasons: [resolved.detail ?? 'activation-unavailable'],
      record: null,
      manifest: null,
    };
  }

  const record =
    resolved.manifest.consumers.find((row) => row.consumerId === consumerId)
    ?? null;
  if (!record) {
    return {
      status: 'unavailable',
      consumerId,
      activationId: resolved.manifest.activationId,
      activationHash: resolved.manifest.activationHash,
      consumerStatus: null,
      combination: null,
      priorCombination: null,
      reasons: ['consumer-missing-from-manifest'],
      record: null,
      manifest: resolved.manifest,
    };
  }

  if (!isConsumerActivationStatus(record.status)) {
    return {
      status: 'unavailable',
      consumerId,
      activationId: resolved.manifest.activationId,
      activationHash: resolved.manifest.activationHash,
      consumerStatus: null,
      combination: null,
      priorCombination: null,
      reasons: [`unknown-status:${String(record.status)}`],
      record: null,
      manifest: resolved.manifest,
    };
  }

  return {
    status: mapStatus(record.status),
    consumerId,
    activationId: resolved.manifest.activationId,
    activationHash: resolved.manifest.activationHash,
    consumerStatus: record.status,
    combination: record.combination,
    priorCombination: record.priorCombination,
    reasons: record.reasons,
    record,
    manifest: resolved.manifest,
  };
}

/** Convenience resolvers for named consumers. */
export function resolveEngineeringGraphActivation(
  paths: ConsumerActivationStorePaths,
): ResolvedConsumerActivation {
  return resolveConsumerActivation(paths, 'engineering-graph');
}

export function resolveEngineeringRagActivation(
  paths: ConsumerActivationStorePaths,
): ResolvedConsumerActivation {
  return resolveConsumerActivation(paths, 'engineering-rag');
}

export function resolveCourseRuntimeActivation(
  paths: ConsumerActivationStorePaths,
): ResolvedConsumerActivation {
  return resolveConsumerActivation(paths, 'course-runtime');
}

export function resolveKonlingActivation(
  paths: ConsumerActivationStorePaths,
): ResolvedConsumerActivation {
  return resolveConsumerActivation(paths, 'konling');
}

export function resolveTeachingResourceRagActivation(
  paths: ConsumerActivationStorePaths,
): ResolvedConsumerActivation {
  return resolveConsumerActivation(paths, 'teaching-resource-rag');
}

export function resolveLearningPathActivation(
  paths: ConsumerActivationStorePaths,
): ResolvedConsumerActivation {
  return resolveConsumerActivation(paths, 'learning-path');
}

/**
 * Whether a consumer may use its combination as production-active.
 * Only READY qualifies; PINNED uses prior combination as fallback but is not
 * a new activation claim.
 */
export function isConsumerProductionReady(
  resolved: ResolvedConsumerActivation,
): boolean {
  return resolved.status === 'ready' && resolved.consumerStatus === 'READY';
}

/**
 * Pin-aware combination: READY uses current combination; PINNED_PREVIOUS uses
 * the pinned combination; others return null (fail closed).
 */
export function resolveConsumerCombinationOrNull(
  resolved: ResolvedConsumerActivation,
): ConsumerVersionCombination | null {
  if (resolved.status === 'ready' || resolved.status === 'pinned') {
    return resolved.combination;
  }
  return null;
}

/**
 * Production selection derived from the consumer activation pointer.
 *
 * - `absent`: no activation pointer / store — callers fall back to legacy
 *   global Authority/Projection current pointers.
 * - `use-combination`: READY consumers use the staged combination as the
 *   production Authority/Projection pair.
 * - `pin-combination`: PINNED / SHADOW / BLOCKED consumers read only their
 *   safe prior (or recorded) combination; they never claim a new activation.
 * - `unavailable`: activation exists but is unusable (unknown id, drift).
 */
export type ConsumerProductionSelectionMode =
  | 'absent'
  | 'use-combination'
  | 'pin-combination'
  | 'unavailable';

export interface ConsumerProductionSelection {
  mode: ConsumerProductionSelectionMode;
  consumerId: ConsumerActivationId | string;
  combination: ConsumerVersionCombination | null;
  resolved: ResolvedConsumerActivation;
  reasons: string[];
}

export function resolveConsumerProductionSelection(
  resolved: ResolvedConsumerActivation,
): ConsumerProductionSelection {
  if (resolved.status === 'unavailable') {
    const absent =
      resolved.reasons.some(
        (reason) =>
          reason === 'current-pointer-missing'
          || reason === 'activation-unavailable'
          || reason.includes('current pointer')
          || reason.includes('pointer-missing')
          || reason.includes('no matching activation'),
      )
      || resolved.activationId === null;
    if (absent && !resolved.reasons.some((r) => r.startsWith('unknown-consumer'))) {
      return {
        mode: 'absent',
        consumerId: resolved.consumerId,
        combination: null,
        resolved,
        reasons: resolved.reasons,
      };
    }
    return {
      mode: 'unavailable',
      consumerId: resolved.consumerId,
      combination: null,
      resolved,
      reasons: resolved.reasons,
    };
  }

  if (resolved.status === 'ready') {
    return {
      mode: 'use-combination',
      consumerId: resolved.consumerId,
      combination: resolved.combination,
      resolved,
      reasons: resolved.reasons,
    };
  }

  // PINNED / SHADOW / BLOCKED: never advance to a new combination as production.
  const combination =
    resolved.priorCombination
    ?? resolved.combination
    ?? null;
  return {
    mode: 'pin-combination',
    consumerId: resolved.consumerId,
    combination,
    resolved,
    reasons: resolved.reasons,
  };
}

/**
 * Resolve a named consumer's production selection from the configured
 * activation store (or an explicit paths override).
 */
export function resolveNamedConsumerProductionSelection(
  consumerId: ConsumerActivationId,
  options: {
    repoRoot?: string;
    activationPaths?: ConsumerActivationStorePaths;
  } = {},
): ConsumerProductionSelection {
  const paths =
    options.activationPaths
    ?? resolveDefaultConsumerActivationStorePaths(options.repoRoot);
  return resolveConsumerProductionSelection(
    resolveConsumerActivation(paths, consumerId),
  );
}

/** Convenience production selections for the six named consumers. */
export function resolveEngineeringGraphProductionSelection(
  options?: Parameters<typeof resolveNamedConsumerProductionSelection>[1],
): ConsumerProductionSelection {
  return resolveNamedConsumerProductionSelection('engineering-graph', options);
}

export function resolveEngineeringRagProductionSelection(
  options?: Parameters<typeof resolveNamedConsumerProductionSelection>[1],
): ConsumerProductionSelection {
  return resolveNamedConsumerProductionSelection('engineering-rag', options);
}

export function resolveCourseRuntimeProductionSelection(
  options?: Parameters<typeof resolveNamedConsumerProductionSelection>[1],
): ConsumerProductionSelection {
  return resolveNamedConsumerProductionSelection('course-runtime', options);
}

export function resolveKonlingProductionSelection(
  options?: Parameters<typeof resolveNamedConsumerProductionSelection>[1],
): ConsumerProductionSelection {
  return resolveNamedConsumerProductionSelection('konling', options);
}

export function resolveTeachingResourceRagProductionSelection(
  options?: Parameters<typeof resolveNamedConsumerProductionSelection>[1],
): ConsumerProductionSelection {
  return resolveNamedConsumerProductionSelection(
    'teaching-resource-rag',
    options,
  );
}

export function resolveLearningPathProductionSelection(
  options?: Parameters<typeof resolveNamedConsumerProductionSelection>[1],
): ConsumerProductionSelection {
  return resolveNamedConsumerProductionSelection('learning-path', options);
}

/**
 * Projection pin fields derived from a production selection.
 * Callers merge these into layered-graph / Konling / path requests.
 */
export function projectionPinsFromSelection(
  selection: ConsumerProductionSelection,
): {
  projectionId: string | null;
  projectionHash: string | null;
  authorityReleaseId: string | null;
  authoritySnapshotId: string | null;
  authoritySnapshotHash: string | null;
  mode: ConsumerProductionSelectionMode;
  reasons: string[];
} {
  const combination = selection.combination;
  return {
    projectionId: combination?.projectionId ?? null,
    projectionHash: combination?.projectionHash ?? null,
    authorityReleaseId: combination?.authorityReleaseId ?? null,
    authoritySnapshotId: combination?.authoritySnapshotId ?? null,
    authoritySnapshotHash: combination?.authoritySnapshotHash ?? null,
    mode: selection.mode,
    reasons: selection.reasons,
  };
}
