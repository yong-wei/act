import { getServerSession } from 'next-auth';

import { UNIT_1_4CourseEntryPage } from '@/features/interactive/unit-1-4-time-frequency-views/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_4TimeFrequencyViewsRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('1-4');
  return <UNIT_1_4CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
