import { redirect } from 'next/navigation';
import { UNIT_5_5TeacherPage } from '@/features/interactive/unit-5-5-policy-learning-entry-risk/teacher-page';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_5TeacherRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: '5-5',
    role: 'teacher',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
  return <UNIT_5_5TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
