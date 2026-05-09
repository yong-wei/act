import { UNIT_5_6StudentPage } from '@/features/interactive/unit-5-6-method-comparison-cold-chain/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_6StudentRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-5-6-method-comparison-cold-chain');

  const lessonRuntime = await loadLessonRuntimeEntry('5-6');
  return <UNIT_5_6StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
