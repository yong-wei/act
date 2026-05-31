import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_5TeacherPage } from '@/features/interactive/unit-3-5-zero-dynamic-improvement/teacher-page';

export default async function UNIT_3_5TeacherRoute(
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
    redirect('/interactive-learning/courses/unit-3-5-zero-dynamic-improvement');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('3-5');
  return <UNIT_3_5TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
