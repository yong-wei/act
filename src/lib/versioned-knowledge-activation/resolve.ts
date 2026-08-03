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
