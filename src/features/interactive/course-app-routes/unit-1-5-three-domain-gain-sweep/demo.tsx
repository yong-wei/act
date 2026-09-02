import { UNIT_1_5StudentPage } from '@/features/interactive/unit-1-5-three-domain-gain-sweep/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_5StudentDemoRoute() {
  const lessonRuntime = await loadLessonRuntimeEntry('1-5');
  return <UNIT_1_5StudentPage sessionId="demo" lessonRuntime={lessonRuntime} />;
}
