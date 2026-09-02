import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_5_1TeacherPage } from '@/features/interactive/unit-5-1-linear-backbone-boundaries/teacher-page';
import { authOptions } from '@/lib/auth';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';

export default async function UNIT_5_1TeacherRoute(
  props: {
    params: Promise<{
      sessionId: string;
    }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-5-1-linear-backbone-boundaries');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/student/${params.sessionId}`);
  }

  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: '5-1',
    role: 'teacher',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
  return <UNIT_5_1TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
