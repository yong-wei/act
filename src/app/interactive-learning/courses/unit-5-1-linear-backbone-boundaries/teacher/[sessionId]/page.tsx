import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_5_1TeacherPage } from '@/features/interactive/unit-5-1-linear-backbone-boundaries/teacher-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export default async function UNIT_5_1TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-5-1-linear-backbone-boundaries');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('5-1');
  return <UNIT_5_1TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
