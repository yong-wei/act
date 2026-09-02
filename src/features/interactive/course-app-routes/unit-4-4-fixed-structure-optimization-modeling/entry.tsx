import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_4_4CourseEntryPage } from '@/features/interactive/unit-4-4-fixed-structure-optimization-modeling/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_4_4ControllerSelectionEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('4-4');
  return <UNIT_4_4CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
