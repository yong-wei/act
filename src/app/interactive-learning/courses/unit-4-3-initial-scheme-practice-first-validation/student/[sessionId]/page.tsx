import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_3StudentPage } from '@/features/interactive/unit-4-3-initial-scheme-practice-first-validation/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export default async function UNIT_4_3StudentRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation');

  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-3');
  return <UNIT_4_3StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
