import { resolveInteractiveLessonIdentity, resolveInteractiveLessonRouteFromPlanTitle } from '@/lib/interactive-lesson-identity';

type SessionRole = 'teacher' | 'student';

/**
 * Resolve the interactive course route for a session participant. The captured
 * bundle canonical id is the authority; the plan title remains a classified
 * compatibility reader for legacy sessions without a binding (ledger C2) and
 * is never the identity of a newly created session.
 */
export function resolveSessionRouteSegment(input: {
  bundleCanonicalLessonId?: string | null;
  planTitle?: string | null;
}): {
  routeSegment: string | null;
  isPremiumCourse: boolean;
  source: 'bundle-binding' | 'plan-title-compatibility' | 'none';
} {
  if (input.bundleCanonicalLessonId) {
    const resolved = resolveInteractiveLessonIdentity({
      kind: 'canonicalId',
      value: input.bundleCanonicalLessonId,
    });
    if (resolved.status === 'resolved' && resolved.record.routeSegments.length > 0) {
      return {
        routeSegment: resolved.record.routeSegments[0],
        isPremiumCourse: true,
        source: 'bundle-binding',
      };
    }
  }
  const { routeSegment, isPremiumCourse } = resolveInteractiveLessonRouteFromPlanTitle(input.planTitle);
  if (routeSegment) {
    return { routeSegment, isPremiumCourse, source: 'plan-title-compatibility' };
  }
  return { routeSegment: null, isPremiumCourse: false, source: 'none' };
}

export function resolveSessionRouteFromPlanTitle(planTitle: string | null | undefined) {
  const { routeSegment, isPremiumCourse } = resolveInteractiveLessonRouteFromPlanTitle(planTitle);
  return {
    routeSegment,
    isPremiumCourse,
  };
}

export function buildSessionParticipantHref({
  role,
  sessionId,
  planTitle,
  bundleCanonicalLessonId,
}: {
  role: SessionRole;
  sessionId: string;
  planTitle: string | null | undefined;
  bundleCanonicalLessonId?: string | null;
}) {
  const { routeSegment } = resolveSessionRouteSegment({ bundleCanonicalLessonId, planTitle });
  if (routeSegment) {
    return `/interactive-learning/courses/${routeSegment}/${role}/${sessionId}`;
  }
  return `/classroom/${role}/${sessionId}`;
}
