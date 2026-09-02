import { getServerSession } from 'next-auth';

import { UNIT_5_1CourseEntryPage } from '@/features/interactive/unit-5-1-linear-backbone-boundaries/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_1LinearBackboneBoundariesEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('5-1');
  return <UNIT_5_1CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
