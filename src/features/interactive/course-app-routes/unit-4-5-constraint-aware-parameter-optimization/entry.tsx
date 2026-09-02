import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_4_5CourseEntryPage } from '@/features/interactive/unit-4-5-constraint-aware-parameter-optimization/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_4_5ConstraintAwareOptimizationEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('4-5');
  return <UNIT_4_5CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
