import { UNIT_1_4StudentPage } from '@/features/interactive/unit-1-4-time-frequency-views/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_4StudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-1-4-time-frequency-views');

  const lessonRuntime = await loadLessonRuntimeEntry('1-4');
  return <UNIT_1_4StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}

