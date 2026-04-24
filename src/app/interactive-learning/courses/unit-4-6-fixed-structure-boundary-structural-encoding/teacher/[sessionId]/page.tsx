import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_4_6TeacherPage } from '@/features/interactive/unit-4-6-fixed-structure-boundary-structural-encoding/teacher-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export default async function UNIT_4_6TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-6');
  return <UNIT_4_6TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
