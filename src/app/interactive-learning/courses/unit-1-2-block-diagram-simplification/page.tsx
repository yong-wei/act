import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_2CourseEntryPage } from '@/features/interactive/unit-1-2-structure-graph/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_2DesignFeasibleDomainEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('1-2');
  return <UNIT_1_2CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
