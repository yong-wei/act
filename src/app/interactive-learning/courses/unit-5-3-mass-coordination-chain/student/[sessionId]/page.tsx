import { UNIT_5_3StudentPage } from '@/features/interactive/unit-5-3-mass-coordination-chain/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_3StudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-5-3-mass-coordination-chain');

  const lessonRuntime = await loadLessonRuntimeEntry('5-3');
  return <UNIT_5_3StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
