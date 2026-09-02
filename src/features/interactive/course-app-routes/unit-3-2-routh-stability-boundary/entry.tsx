import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_3_2CourseEntryPage } from '@/features/interactive/unit-3-2-routh-stability-boundary/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_3_2PurePoleEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('3-2');
  return <UNIT_3_2CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
