import { getServerSession } from 'next-auth';

import { UNIT_5_2CourseEntryPage } from '@/features/interactive/unit-5-2-nonlinear-analysis-entry/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_2NonlinearAnalysisEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('5-2');
  return <UNIT_5_2CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
