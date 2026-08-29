import { getServerSession } from 'next-auth';

import { UNIT_4_7CourseEntryPage } from '@/features/interactive/unit-4-7-destroyer-hifi-design-closure/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_4_7DestroyerHifiDesignClosureEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('4-7');
  return <UNIT_4_7CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
