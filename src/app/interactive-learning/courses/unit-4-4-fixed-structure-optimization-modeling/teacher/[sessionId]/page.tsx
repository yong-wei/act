import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_4TeacherPage } from '@/features/interactive/unit-4-4-fixed-structure-optimization-modeling/teacher-page';

export default async function UNIT_4_4TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-4');
  return <UNIT_4_4TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
