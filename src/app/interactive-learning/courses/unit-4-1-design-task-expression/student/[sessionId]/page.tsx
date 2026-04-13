import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_1StudentPage } from '@/features/interactive/unit-4-1-design-task-expression/student-page';

export default async function UNIT_4_1StudentRoute({
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
      redirect('/interactive-learning/courses/unit-4-1-design-task-expression');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-4-1-design-task-expression/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-1');
  return <UNIT_4_1StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
