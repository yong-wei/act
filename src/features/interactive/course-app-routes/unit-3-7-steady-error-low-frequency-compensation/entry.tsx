import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_3_7CourseEntryPage } from '@/features/interactive/unit-3-7-steady-error-low-frequency-compensation/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_3_7RootLocusReadingValidationEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('3-7');
  return <UNIT_3_7CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
