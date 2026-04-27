import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_4_7StudentPage } from '@/features/interactive/unit-4-7-destroyer-hifi-design-closure/student-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export default async function UNIT_4_7StudentRoute({
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
      redirect('/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-7');
  return <UNIT_4_7StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
