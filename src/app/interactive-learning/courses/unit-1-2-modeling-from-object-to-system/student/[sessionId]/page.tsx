import { UNIT_1_2StudentPage } from '@/features/interactive/unit-1-2-modeling-from-object-to-system/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_2StudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system');

  const lessonRuntime = await loadLessonRuntimeEntry('1-2');
  return <UNIT_1_2StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
