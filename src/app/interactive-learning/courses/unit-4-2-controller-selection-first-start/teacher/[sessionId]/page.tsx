import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_2TeacherPage } from '@/features/interactive/unit-4-2-controller-selection-first-start/teacher-page';

export default async function UNIT_4_2TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-4-2-controller-selection-first-start');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-2');
  return <UNIT_4_2TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
