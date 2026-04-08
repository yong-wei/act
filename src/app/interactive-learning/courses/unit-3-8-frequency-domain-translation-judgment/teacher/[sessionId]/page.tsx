import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_8TeacherPage } from '@/features/interactive/unit-3-8-frequency-domain-translation-judgment/teacher-page';

export default async function UNIT_3_8TeacherRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await getServerSession(authOptions);
  const role = String(session?.user?.role ?? '').trim().toUpperCase();

  if (!session) {
    redirect('/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment');
  }

  if (role === 'STUDENT' && params.sessionId !== 'demo') {
    redirect(`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('3-8');
  return <UNIT_3_8TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
