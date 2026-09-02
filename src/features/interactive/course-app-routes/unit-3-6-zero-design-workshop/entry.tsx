import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_3_6CourseEntryPage } from '@/features/interactive/unit-3-6-zero-design-workshop/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_3_6ZeroDesignWorkshopEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('3-6');
  return <UNIT_3_6CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
