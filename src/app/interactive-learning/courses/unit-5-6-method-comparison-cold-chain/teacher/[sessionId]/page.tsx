import { UNIT_5_6TeacherPage } from '@/features/interactive/unit-5-6-method-comparison-cold-chain/teacher-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_6TeacherRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  const lessonRuntime = await loadLessonRuntimeEntry('5-6');
  return <UNIT_5_6TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
