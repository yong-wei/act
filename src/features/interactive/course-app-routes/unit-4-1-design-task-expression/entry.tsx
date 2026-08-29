import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_1CourseEntryPage } from '@/features/interactive/unit-4-1-design-task-expression/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_4_1RootLocusReadingValidationEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('4-1');
  return <UNIT_4_1CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
