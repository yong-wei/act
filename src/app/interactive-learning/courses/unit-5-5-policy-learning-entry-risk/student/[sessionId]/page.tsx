import { UNIT_5_5StudentPage } from '@/features/interactive/unit-5-5-policy-learning-entry-risk/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_5StudentRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  const lessonRuntime = await loadLessonRuntimeEntry('5-5');
  return <UNIT_5_5StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
