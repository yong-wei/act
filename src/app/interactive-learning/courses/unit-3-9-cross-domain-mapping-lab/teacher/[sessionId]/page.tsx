import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_9TeacherPage } from '@/features/interactive/unit-3-9-cross-domain-mapping-lab/teacher-page';

export default async function UNIT_3_9TeacherRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await getServerSession(authOptions);
  const role = String(session?.user?.role ?? '').trim().toUpperCase();

  if (!session) {
    redirect('/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab');
  }

  if (role === 'STUDENT' && params.sessionId !== 'demo') {
    redirect(`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('3-9');
  return <UNIT_3_9TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
