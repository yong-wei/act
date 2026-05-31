import { UNIT_5_5StudentPage } from '@/features/interactive/unit-5-5-policy-learning-entry-risk/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_5StudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-5-5-policy-learning-entry-risk');

  const lessonRuntime = await loadLessonRuntimeEntry('5-5');
  return <UNIT_5_5StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
