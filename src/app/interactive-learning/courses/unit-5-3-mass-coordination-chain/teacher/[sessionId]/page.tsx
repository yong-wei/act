import { UNIT_5_3TeacherPage } from '@/features/interactive/unit-5-3-mass-coordination-chain/teacher-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_3TeacherRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  const lessonRuntime = await loadLessonRuntimeEntry('5-3');
  return <UNIT_5_3TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
