import { getServerSession } from 'next-auth';

import { UNIT_5_6CourseEntryPage } from '@/features/interactive/unit-5-6-method-comparison-cold-chain/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_6MethodComparisonColdChainRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('5-6');
  return <UNIT_5_6CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
