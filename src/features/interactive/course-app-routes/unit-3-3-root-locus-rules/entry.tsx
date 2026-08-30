import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_3CourseEntryPage } from '@/features/interactive/unit-3-3-root-locus-rules/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_3_3PurePoleEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('3-3');
  return <UNIT_3_3CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
