import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_4_6StudentPage } from '@/features/interactive/unit-4-6-fixed-structure-boundary-structural-encoding/student-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export default async function UNIT_4_6StudentRoute({
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
      redirect('/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-6');
  return <UNIT_4_6StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
