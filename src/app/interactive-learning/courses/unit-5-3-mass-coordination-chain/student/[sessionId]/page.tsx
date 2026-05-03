import { UNIT_5_3StudentPage } from '@/features/interactive/unit-5-3-mass-coordination-chain/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_3StudentRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  const lessonRuntime = await loadLessonRuntimeEntry('5-3');
  return <UNIT_5_3StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
