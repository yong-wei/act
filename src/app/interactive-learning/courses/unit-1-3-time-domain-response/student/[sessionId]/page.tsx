import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_3StudentPage } from '@/features/interactive/unit-1-3-time-response/student-page';

export default async function UNIT_1_3StudentRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/unit-1-3-time-domain-response');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-1-3-time-domain-response/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('1-3');
  return <UNIT_1_3StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
