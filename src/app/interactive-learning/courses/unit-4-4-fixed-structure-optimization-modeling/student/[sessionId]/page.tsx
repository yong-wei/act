import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_4StudentPage } from '@/features/interactive/unit-4-4-fixed-structure-optimization-modeling/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export default async function UNIT_4_4StudentRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling');

  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-4');
  return <UNIT_4_4StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
