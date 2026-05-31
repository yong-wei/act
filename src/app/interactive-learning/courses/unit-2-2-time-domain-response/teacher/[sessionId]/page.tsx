import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_2_2TeacherPage } from '@/features/interactive/unit-2-2-time-response/teacher-page';

export default async function UNIT_2_2TeacherRoute(
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
    redirect('/interactive-learning/courses/unit-2-2-time-domain-response');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-2-2-time-domain-response/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('2-2');
  return <UNIT_2_2TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
