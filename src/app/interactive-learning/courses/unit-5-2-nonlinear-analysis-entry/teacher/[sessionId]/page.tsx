import { UNIT_5_2TeacherPage } from '@/features/interactive/unit-5-2-nonlinear-analysis-entry/teacher-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_2TeacherRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  const lessonRuntime = await loadLessonRuntimeEntry('5-2');
  return <UNIT_5_2TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
