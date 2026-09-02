import { redirect } from 'next/navigation';
import { UNIT_5_5StudentPage } from '@/features/interactive/unit-5-5-policy-learning-entry-risk/student-page';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_5StudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-5-5-policy-learning-entry-risk');

  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: '5-5',
    role: 'student',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
  return <UNIT_5_5StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
