import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_2CourseEntryPage } from '@/features/interactive/unit-4-2-controller-selection-first-start/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_4_2ControllerSelectionEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('4-2');
  return <UNIT_4_2CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
