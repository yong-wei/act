import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';
import { UNIT_3_5StudentPage } from '@/features/interactive/unit-3-5-zero-dynamic-improvement/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export default async function UNIT_3_5StudentRoute(
  props: {
    params: Promise<{
      sessionId: string;
    }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-3-5-zero-dynamic-improvement');

  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/unit-3-5-zero-dynamic-improvement');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/teacher/${params.sessionId}`);
    }
  }

  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: '3-5',
    role: 'student',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
  return <UNIT_3_5StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
