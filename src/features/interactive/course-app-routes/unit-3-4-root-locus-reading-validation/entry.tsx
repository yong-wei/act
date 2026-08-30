import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_4CourseEntryPage } from '@/features/interactive/unit-3-4-root-locus-reading-validation/entry-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_3_4RootLocusReadingValidationEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('3-4');
  return <UNIT_3_4CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
