import { resolveInteractiveLessonRouteFromPlanTitle } from '@/lib/interactive-lesson-identity';

type SessionRole = 'teacher' | 'student';

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
}: {
  role: SessionRole;
  sessionId: string;
  planTitle: string | null | undefined;
}) {
  const { routeSegment } = resolveSessionRouteFromPlanTitle(planTitle);
  if (routeSegment) {
    return `/interactive-learning/courses/${routeSegment}/${role}/${sessionId}`;
  }
  return `/classroom/${role}/${sessionId}`;
}
