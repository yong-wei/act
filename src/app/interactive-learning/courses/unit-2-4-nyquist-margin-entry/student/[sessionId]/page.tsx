import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_2_4StudentPage } from '@/features/interactive/unit-2-4-nyquist-margin-entry/student-page';

export default async function UNIT_2_4StudentRoute({
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
      redirect('/interactive-learning/courses/unit-2-4-nyquist-margin-entry');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('2-4');
  return <UNIT_2_4StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
