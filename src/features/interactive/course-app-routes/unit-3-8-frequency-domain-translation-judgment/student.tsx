import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle/session-reader';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';
import { UNIT_3_8StudentPage } from '@/features/interactive/unit-3-8-frequency-domain-translation-judgment/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export default async function UNIT_3_8StudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment');

  const session = await getServerSession(authOptions);
  const role = String(session?.user?.role ?? '').trim().toUpperCase();

  if (!session && params.sessionId !== 'demo') {
    redirect('/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment');
  }

  if ((role === 'TEACHER' || role === 'ADMIN') && params.sessionId !== 'demo') {
    redirect(`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/teacher/${params.sessionId}`);
  }

  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: '3-8',
    role: 'student',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
  return <UNIT_3_8StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
