import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_3CourseEntryPage } from '@/features/interactive/unit-1-3-time-response/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_3DesignFeasibleDomainEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('2-2');
  return <UNIT_1_3CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
