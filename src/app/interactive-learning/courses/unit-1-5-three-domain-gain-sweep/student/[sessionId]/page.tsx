import { UNIT_1_5StudentPage } from '@/features/interactive/unit-1-5-three-domain-gain-sweep/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_5StudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-1-5-three-domain-gain-sweep');

  const lessonRuntime = await loadLessonRuntimeEntry('1-5');
  return <UNIT_1_5StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
