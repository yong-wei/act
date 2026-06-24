import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_4_7StudentPage } from '@/features/interactive/unit-4-7-destroyer-hifi-design-closure/student-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
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

  const lessonRuntime = await loadLessonRuntimeEntry('4-7');
  return <UNIT_4_7StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
