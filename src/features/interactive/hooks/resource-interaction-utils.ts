'use client';

export type ResourceCompletionEventType =
  | 'resource_complete'
  | 'assessment_complete'
  | 'simulation_finish';

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
