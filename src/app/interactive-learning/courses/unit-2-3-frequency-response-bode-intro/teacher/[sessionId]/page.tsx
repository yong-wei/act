import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_2_3TeacherPage } from '@/features/interactive/unit-2-3-frequency-response/teacher-page';

export default async function UNIT_2_3TeacherRoute(
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
    redirect('/interactive-learning/courses/unit-2-3-frequency-response-bode-intro');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('2-3');
  return <UNIT_2_3TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
