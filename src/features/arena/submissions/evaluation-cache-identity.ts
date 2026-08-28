import { runtimeIdentity, stableStringify } from '@/lib/control-engine';

import { getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';

export const ARENA_EVALUATION_CACHE_BINDING_KEY = 'cacheBinding';

export type ArenaEvaluationCacheBinding = {
  runtimeBuildHash: string;
  runtimeProtocolVersion: string;
  runtimeSchemaVersion: string;
  specIdentity: string;
  modelIdentity: string;
};

export function isCompleteArenaEvaluationCacheIdentity(input: {
  taskId?: string | null;
  artifactHash?: string | null;
  protocolVersion?: string | null;
}): boolean {
  return [input.taskId, input.artifactHash, input.protocolVersion]
    .every((value) => typeof value === 'string' && value.trim().length > 0);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function readStoredArenaEvaluationCacheBinding(metadata: unknown): ArenaEvaluationCacheBinding | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const raw = (metadata as Record<string, unknown>)[ARENA_EVALUATION_CACHE_BINDING_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (
    !nonEmptyString(record.runtimeBuildHash)
    || !nonEmptyString(record.runtimeProtocolVersion)
    || !nonEmptyString(record.runtimeSchemaVersion)
    || !nonEmptyString(record.specIdentity)
    || !nonEmptyString(record.modelIdentity)
  ) {
    return null;
  }
  return {
    runtimeBuildHash: record.runtimeBuildHash.trim(),
    runtimeProtocolVersion: record.runtimeProtocolVersion.trim(),
    runtimeSchemaVersion: record.runtimeSchemaVersion.trim(),
    specIdentity: record.specIdentity.trim(),
    modelIdentity: record.modelIdentity.trim(),
  };
}

export function arenaEvaluationCacheBindingConflicts(
  metadata: unknown,
  current: ArenaEvaluationCacheBinding,
): boolean {
  const stored = readStoredArenaEvaluationCacheBinding(metadata);
  if (!stored) return false;
  return stored.runtimeBuildHash !== current.runtimeBuildHash
    || stored.runtimeProtocolVersion !== current.runtimeProtocolVersion
    || stored.runtimeSchemaVersion !== current.runtimeSchemaVersion
    || stored.specIdentity !== current.specIdentity
    || stored.modelIdentity !== current.modelIdentity;
}

export function withArenaEvaluationCacheBinding(
  metadata: Record<string, unknown> | undefined,
  binding: ArenaEvaluationCacheBinding,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [ARENA_EVALUATION_CACHE_BINDING_KEY]: binding,
  };
}

export function resolveArenaEvaluationCacheBinding(taskId: string): ArenaEvaluationCacheBinding {
  const identity = runtimeIdentity();
  const task = getArenaChallengeTask(taskId);
  const object = task ? getArenaChallengeObject(task.objectId) : undefined;
  const specIdentity = task
    ? stableStringify({
      id: task.id,
      objectId: task.objectId,
      metricProfileId: task.metricProfileId,
      allowedMethods: [...task.allowedMethods].sort(),
      primaryMetrics: [...task.primaryMetrics].sort(),
    })
    : taskId;
  const modelIdentity = object?.modelVersion
    ?? (object?.model
      ? stableStringify({
        numerator: object.model.numerator,
        denominator: object.model.denominator,
      })
      : object?.id ?? taskId);
  return {
    runtimeBuildHash: identity.buildHash,
    runtimeProtocolVersion: identity.protocolVersion,
    runtimeSchemaVersion: identity.schemaVersion,
    specIdentity,
    modelIdentity,
  };
}
