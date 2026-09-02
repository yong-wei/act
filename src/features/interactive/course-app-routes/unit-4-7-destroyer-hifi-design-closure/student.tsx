import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_4_7StudentPage } from '@/features/interactive/unit-4-7-destroyer-hifi-design-closure/student-page';
import { authOptions } from '@/lib/auth';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export default async function UNIT_4_7StudentRoute(
  props: {
    params: Promise<{
      sessionId: string;
    }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure');

  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/teacher/${params.sessionId}`);
    }
  }

  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: '4-7',
    role: 'student',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
  return <UNIT_4_7StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
