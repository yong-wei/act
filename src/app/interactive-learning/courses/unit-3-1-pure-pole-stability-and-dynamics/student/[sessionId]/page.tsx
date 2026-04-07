import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_1StudentPage } from '@/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/student-page';

export default async function UNIT_3_1StudentRoute({
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
      redirect('/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('3-1');
  return <UNIT_3_1StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
