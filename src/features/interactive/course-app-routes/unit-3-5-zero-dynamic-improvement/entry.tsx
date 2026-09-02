import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_3_5CourseEntryPage } from '@/features/interactive/unit-3-5-zero-dynamic-improvement/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_3_5ZeroDynamicImprovementEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('3-5');
  return <UNIT_3_5CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
