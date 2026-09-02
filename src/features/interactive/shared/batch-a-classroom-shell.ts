import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';

export const BATCH_A_CANONICAL_IDS = [
  '1-1', '1-2', '1-3', '1-4', '1-5',
  '2-1', '2-2', '2-3', '2-4',
  '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9',
] as const;

export type BatchACanonicalId = (typeof BATCH_A_CANONICAL_IDS)[number];

const BATCH_A_ID_SET = new Set<string>(BATCH_A_CANONICAL_IDS);

export function isBatchACanonicalId(value: string): value is BatchACanonicalId {
  return BATCH_A_ID_SET.has(value);
}

export function resolveBatchALesson(routeSegment: string): { canonicalId: BatchACanonicalId; routeSegment: string } | null {
  const resolved = resolveInteractiveLessonIdentity({ kind: 'routeSegment', value: routeSegment });
  if (resolved.status !== 'resolved' || !isBatchACanonicalId(resolved.record.canonicalId)) {
    return null;
  }
  return {
    canonicalId: resolved.record.canonicalId,
    routeSegment: resolved.record.routeSegments[0] ?? routeSegment,
  };
}

export function isTeacherOrAdminRole(role: unknown) {
  return ['TEACHER', 'ADMIN', '教师', '管理员'].includes(String(role ?? '').toUpperCase());
}
