import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_2_3CourseEntryPage } from '@/features/interactive/unit-2-3-frequency-response/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_2_3FrequencyResponseEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('2-3');
  return <UNIT_2_3CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
