import { UNIT_5_5TeacherPage } from '@/features/interactive/unit-5-5-policy-learning-entry-risk/teacher-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_5TeacherRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  const lessonRuntime = await loadLessonRuntimeEntry('5-5');
  return <UNIT_5_5TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
