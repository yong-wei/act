import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_3CourseEntryPage } from '@/features/interactive/unit-4-3-initial-scheme-practice-first-validation/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_4_3ControllerSelectionEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('4-3');
  return <UNIT_4_3CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
