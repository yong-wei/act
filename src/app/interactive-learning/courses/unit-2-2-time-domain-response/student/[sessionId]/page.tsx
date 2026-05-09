import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_2_2StudentPage } from '@/features/interactive/unit-2-2-time-response/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export default async function UNIT_2_2StudentRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-2-2-time-domain-response');

  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/unit-2-2-time-domain-response');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-2-2-time-domain-response/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('2-2');
  return <UNIT_2_2StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
