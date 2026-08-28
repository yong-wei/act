import { resolveInteractiveLessonIdentity, resolveInteractiveLessonRouteFromPlanTitle } from '@/lib/interactive-lesson-identity';

type SessionRole = 'teacher' | 'student';

/**
 * Resolve the interactive course route for a session participant. The captured
 * bundle canonical id is the authority. The plan title remains a classified
 * compatibility reader ONLY for legacy sessions without any binding (ledger
 * C2): a bound session whose canonical id is not a registered interactive
 * course (plan/generated namespaces) must stay on the generic classroom shell
 * instead of falling back to a mutable title, which could redirect-loop with
 * the route-mismatch guard on course pages.
 */
export function resolveSessionRouteSegment(input: {
  bundleCanonicalLessonId?: string | null;
  bundleBound?: boolean;
  planTitle?: string | null;
}): {
  routeSegment: string | null;
  isPremiumCourse: boolean;
  source: 'bundle-binding' | 'plan-title-compatibility' | 'none';
} {
  if (input.bundleBound) {
    const resolved = input.bundleCanonicalLessonId
      ? resolveInteractiveLessonIdentity({
        kind: 'canonicalId',
        value: input.bundleCanonicalLessonId,
      })
      : null;
    if (resolved?.status === 'resolved' && resolved.record.routeSegments.length > 0) {
      return {
        routeSegment: resolved.record.routeSegments[0],
        isPremiumCourse: true,
        source: 'bundle-binding',
      };
    }
    return { routeSegment: null, isPremiumCourse: false, source: 'none' };
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
  bundleBound,
}: {
  role: SessionRole;
  sessionId: string;
  planTitle: string | null | undefined;
  bundleCanonicalLessonId?: string | null;
  bundleBound?: boolean;
}) {
  const { routeSegment } = resolveSessionRouteSegment({
    bundleCanonicalLessonId,
    bundleBound,
    planTitle,
  });
  if (routeSegment) {
    return `/interactive-learning/courses/${routeSegment}/${role}/${sessionId}`;
  }
  return `/classroom/${role}/${sessionId}`;
}
