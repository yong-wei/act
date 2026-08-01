/**
 * Fail-closed write guard for stopped Legacy learning paths (#1115).
 *
 * Changing pathStatus alone is insufficient — every execution / deviation /
 * intervention / choice mutation path must consult this guard.
 */

import {
  isLegacyStoppedPathStatus,
  LEGACY_STOPPED_PATH_STATUS,
} from './contracts';

export const LEGACY_PATH_MUTATION_BLOCKED_CODE = 'LEGACY_PATH_STOPPED' as const;
export const LEGACY_PATH_MUTATION_BLOCKED_REASON =
  'legacy-stopped-immutable' as const;

export type LearningPathMutationTarget = {
  id?: string | null;
  pathStatus?: string | null;
  pathPayload?: unknown;
};

export type LearningPathMutationBlock = {
  blocked: true;
  code: typeof LEGACY_PATH_MUTATION_BLOCKED_CODE;
  reason: typeof LEGACY_PATH_MUTATION_BLOCKED_REASON;
  pathStatus: string;
  pathId: string | null;
};

export function isLearningPathWriteBlocked(
  path: LearningPathMutationTarget | null | undefined,
): boolean {
  if (!path) return false;
  if (isLegacyStoppedPathStatus(path.pathStatus)) return true;
  // Defense in depth: payload marker may exist if status was partially updated.
  const payload = asRecord(path.pathPayload);
  if (payload.legacyArchiveState === LEGACY_STOPPED_PATH_STATUS) return true;
  if (payload.readOnlyStopped === true && payload.knowledgeAuthority !== 'CANONICAL') {
    return true;
  }
  return false;
}

export function assertLearningPathWritable(
  path: LearningPathMutationTarget | null | undefined,
): LearningPathMutationBlock | null {
  if (!isLearningPathWriteBlocked(path)) return null;
  return {
    blocked: true,
    code: LEGACY_PATH_MUTATION_BLOCKED_CODE,
    reason: LEGACY_PATH_MUTATION_BLOCKED_REASON,
    pathStatus: typeof path?.pathStatus === 'string'
      ? path.pathStatus
      : LEGACY_STOPPED_PATH_STATUS,
    pathId: typeof path?.id === 'string' ? path.id : null,
  };
}

export class LearningPathMutationBlockedError extends Error {
  readonly code = LEGACY_PATH_MUTATION_BLOCKED_CODE;
  readonly reason = LEGACY_PATH_MUTATION_BLOCKED_REASON;
  readonly pathStatus: string;
  readonly pathId: string | null;

  constructor(block: LearningPathMutationBlock) {
    super(`Learning path mutation blocked: ${block.reason}`);
    this.name = 'LearningPathMutationBlockedError';
    this.pathStatus = block.pathStatus;
    this.pathId = block.pathId;
  }
}

export function throwIfLearningPathNotWritable(
  path: LearningPathMutationTarget | null | undefined,
): void {
  const block = assertLearningPathWritable(path);
  if (block) throw new LearningPathMutationBlockedError(block);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
