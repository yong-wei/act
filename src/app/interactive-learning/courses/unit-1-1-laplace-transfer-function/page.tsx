import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_1CourseEntryPage } from '@/features/interactive/unit-1-1-laplace/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_1DesignFeasibleDomainEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('1-1');
  return <UNIT_1_1CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
