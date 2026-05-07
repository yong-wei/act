import { UNIT_5_6StudentPage } from '@/features/interactive/unit-5-6-method-comparison-cold-chain/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_6StudentRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  const lessonRuntime = await loadLessonRuntimeEntry('5-6');
  return <UNIT_5_6StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
