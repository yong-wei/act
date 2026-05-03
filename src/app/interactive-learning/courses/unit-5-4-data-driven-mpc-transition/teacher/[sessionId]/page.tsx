import { UNIT_5_4TeacherPage } from '@/features/interactive/unit-5-4-data-driven-mpc-transition/teacher-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_4TeacherRoute({
  params,
}: {
  params: { sessionId: string };
}) {
  const lessonRuntime = await loadLessonRuntimeEntry('5-4');
  return <UNIT_5_4TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
