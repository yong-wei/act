import { getServerSession } from 'next-auth';

import { UNIT_4_6CourseEntryPage } from '@/features/interactive/unit-4-6-fixed-structure-boundary-structural-encoding/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';

export const dynamic = 'force-dynamic';

export default async function UNIT_4_6StructuralEncodingEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('4-6');
  return <UNIT_4_6CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
