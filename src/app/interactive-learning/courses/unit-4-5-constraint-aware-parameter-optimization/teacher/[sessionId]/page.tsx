import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_5TeacherPage } from '@/features/interactive/unit-4-5-constraint-aware-parameter-optimization/teacher-page';

export default async function UNIT_4_5TeacherRoute(
  props: {
    params: Promise<{
      sessionId: string;
    }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-5');
  return <UNIT_4_5TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
