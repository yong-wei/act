import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';
import { UNIT_4_3TeacherPage } from '@/features/interactive/unit-4-3-initial-scheme-practice-first-validation/teacher-page';

export default async function UNIT_4_3TeacherRoute(
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
    redirect('/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/${params.sessionId}`);
  }

  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: '4-3',
    role: 'teacher',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
  return <UNIT_4_3TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
