import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_1StudentPage } from '@/features/interactive/unit-1-1-see-the-full-picture/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_1SeeTheFullPictureStudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-1-1-see-the-full-picture');

  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('1-1');

  if (!session?.user) {
    return <UNIT_1_1StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
  }

  return <UNIT_1_1StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
