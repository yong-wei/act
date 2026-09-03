'use client';

import type { InteractiveLaunchContext, InteractiveLaunchProvenance } from '../types';

export type ResourceCompletionEventType =
  | 'resource_complete'
  | 'assessment_complete'
  | 'simulation_finish';

/**
 * 学习来源解析（Issue #1914）：显式启动契约优先；无契约时保持既有
 * embedded/sessionId 推断，兼容共享渲染器之外的直用方。
 */
export function resolveInteractiveLaunchProvenance({
  embedded,
  sessionId,
  launchContext,
}: {
  embedded?: boolean;
  sessionId?: string | null;
  launchContext?: InteractiveLaunchContext | null;
} = {}): InteractiveLaunchProvenance {
  if (launchContext) return launchContext.provenance;
  return !embedded && !sessionId ? 'standalone' : 'classroom';
}

function normalizeToken(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function hasSemanticToken(value: string, token: string) {
  return new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`, 'i').test(value);
}

export function slugifyTrackingTarget(value: string | null | undefined) {
  return normalizeToken(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function inferStandaloneCompletionEventType({
  registryId,
  resourceType,
  surface,
}: {
  registryId?: string | null;
  resourceType?: string | null;
  surface?: string | null;
}): ResourceCompletionEventType {
  const registryToken = normalizeToken(registryId);
  const resourceToken = normalizeToken(resourceType);
  const surfaceToken = normalizeToken(surface);
  const combined = `${registryToken} ${resourceToken} ${surfaceToken}`;

  if (
    combined.includes('simulation')
    || hasSemanticToken(combined, 'sim')
    || combined.includes('simulator')
    || surfaceToken === 'simulation'
  ) {
    return 'simulation_finish';
  }

  if (
    combined.includes('quiz')
    || combined.includes('assessment')
    || combined.includes('practice')
    || combined.includes('question')
  ) {
    return 'assessment_complete';
  }

  return 'resource_complete';
}
