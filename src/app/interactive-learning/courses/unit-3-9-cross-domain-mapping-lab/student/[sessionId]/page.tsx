import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_9StudentPage } from '@/features/interactive/unit-3-9-cross-domain-mapping-lab/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export default async function UNIT_3_9StudentRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab');

  const session = await getServerSession(authOptions);
  const role = String(session?.user?.role ?? '').trim().toUpperCase();

  if (!session && params.sessionId !== 'demo') {
    redirect('/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab');
  }

  if ((role === 'TEACHER' || role === 'ADMIN') && params.sessionId !== 'demo') {
    redirect(`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/teacher/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('3-9');
  return <UNIT_3_9StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
