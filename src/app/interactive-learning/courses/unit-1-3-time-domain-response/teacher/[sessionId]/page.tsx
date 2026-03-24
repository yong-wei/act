import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_3TeacherPage } from '@/features/interactive/unit-1-3-time-response/teacher-page';

export default async function UNIT_1_3TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-1-3-time-domain-response');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-1-3-time-domain-response/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('2-2');
  return <UNIT_1_3TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
