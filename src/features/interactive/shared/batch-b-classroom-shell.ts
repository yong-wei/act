import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';

export const BATCH_B_CANONICAL_IDS = [
  '4-1', '4-2', '4-3', '4-4', '4-5', '4-6', '4-7',
  '5-1', '5-2', '5-3', '5-4', '5-5', '5-6',
  'cruise-comfort-boppps',
] as const;

export type BatchBCanonicalId = (typeof BATCH_B_CANONICAL_IDS)[number];

const BATCH_B_ID_SET = new Set<string>(BATCH_B_CANONICAL_IDS);

export function isBatchBCanonicalId(value: string): value is BatchBCanonicalId {
  return BATCH_B_ID_SET.has(value);
}

export function resolveBatchBLesson(routeSegment: string): { canonicalId: BatchBCanonicalId; routeSegment: string } | null {
  const resolved = resolveInteractiveLessonIdentity({ kind: 'routeSegment', value: routeSegment });
  if (resolved.status !== 'resolved' || !isBatchBCanonicalId(resolved.record.canonicalId)) {
    return null;
  }
  return {
    canonicalId: resolved.record.canonicalId,
    routeSegment: resolved.record.routeSegments[0] ?? routeSegment,
  };
}
