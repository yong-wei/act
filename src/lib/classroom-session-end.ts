import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

export function buildSessionEndReturnHref({
  classId,
  planTitle,
}: {
  classId: string | null | undefined;
  planTitle: string | null | undefined;
}) {
  if (classId) {
    return `/teacher/classes/${classId}`;
  }

  const { routeSegment } = resolveSessionRouteFromPlanTitle(planTitle);
  if (routeSegment) {
    return `/interactive-learning/courses/${routeSegment}`;
  }

  return '/teacher/lesson-plans';
}
