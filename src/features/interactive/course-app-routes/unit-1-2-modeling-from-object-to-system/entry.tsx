import { getServerSession } from 'next-auth';

import { UNIT_1_2CourseEntryPage } from '@/features/interactive/unit-1-2-modeling-from-object-to-system/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_2ModelingFromObjectToSystemRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('1-2');
  return <UNIT_1_2CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
