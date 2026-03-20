import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_2TeacherPage } from '@/features/interactive/unit-1-2-structure-graph/teacher-page';

export default async function UNIT_1_2TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-1-2-block-diagram-simplification');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-1-2-block-diagram-simplification/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('1-2');
  return <UNIT_1_2TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
