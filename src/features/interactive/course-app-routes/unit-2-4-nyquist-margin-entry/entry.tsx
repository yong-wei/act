import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_2_4CourseEntryPage } from '@/features/interactive/unit-2-4-nyquist-margin-entry/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_2_4FrequencyResponseEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('2-4');
  return <UNIT_2_4CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
