import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_2_1StudentPage } from '@/features/interactive/unit-2-1-modeling-language/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_2_1ModelingLanguageStudentRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-2-1-modeling-language');

  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('2-1');

  if (!session?.user) {
    return <UNIT_2_1StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
  }

  return <UNIT_2_1StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
