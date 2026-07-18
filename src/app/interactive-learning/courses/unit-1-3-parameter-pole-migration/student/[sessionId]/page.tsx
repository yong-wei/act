import { UNIT_1_3StudentPage } from '@/features/interactive/unit-1-3-parameter-pole-migration/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_3StudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-1-3-parameter-pole-migration');

  const lessonRuntime = await loadLessonRuntimeEntry('1-3');
  return <UNIT_1_3StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
