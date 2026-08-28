import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle/session-reader';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';
import { UNIT_3_9StudentPage } from '@/features/interactive/unit-3-9-cross-domain-mapping-lab/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export default async function UNIT_3_9StudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab');

  const session = await getServerSession(authOptions);
  const role = String(session?.user?.role ?? '').trim().toUpperCase();

  if (!session && params.sessionId !== 'demo') {
    redirect('/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab');
  }

  if ((role === 'TEACHER' || role === 'ADMIN') && params.sessionId !== 'demo') {
    redirect(`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/teacher/${params.sessionId}`);
  }

  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: '3-9',
    role: 'student',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
  return <UNIT_3_9StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
