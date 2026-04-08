import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_8StudentPage } from '@/features/interactive/unit-3-8-frequency-domain-translation-judgment/student-page';

export default async function UNIT_3_8StudentRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await getServerSession(authOptions);
  const role = String(session?.user?.role ?? '').trim().toUpperCase();

  if (!session && params.sessionId !== 'demo') {
    redirect('/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment');
  }

  if ((role === 'TEACHER' || role === 'ADMIN') && params.sessionId !== 'demo') {
    redirect(`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/teacher/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('3-8');
  return <UNIT_3_8StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
