import { UNIT_5_4StudentPage } from '@/features/interactive/unit-5-4-data-driven-mpc-transition/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_4StudentRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-5-4-data-driven-mpc-transition');

  const lessonRuntime = await loadLessonRuntimeEntry('5-4');
  return <UNIT_5_4StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
