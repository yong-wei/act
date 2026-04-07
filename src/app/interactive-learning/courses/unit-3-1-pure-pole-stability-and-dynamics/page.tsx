import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_1CourseEntryPage } from '@/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_3_1PurePoleEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('3-1');
  return <UNIT_3_1CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
