import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_2_2CourseEntryPage } from '@/features/interactive/unit-2-2-time-response/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_2_2DesignFeasibleDomainEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('2-2');
  return <UNIT_2_2CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
