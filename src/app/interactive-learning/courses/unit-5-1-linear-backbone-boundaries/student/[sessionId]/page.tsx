import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_5_1StudentPage } from '@/features/interactive/unit-5-1-linear-backbone-boundaries/student-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export default async function UNIT_5_1StudentRoute(
  props: {
    params: Promise<{
      sessionId: string;
    }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-5-1-linear-backbone-boundaries');

  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/unit-5-1-linear-backbone-boundaries');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('5-1');
  return <UNIT_5_1StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
