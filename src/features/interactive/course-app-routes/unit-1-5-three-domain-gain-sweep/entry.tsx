import { getServerSession } from 'next-auth';

import { UNIT_1_5CourseEntryPage } from '@/features/interactive/unit-1-5-three-domain-gain-sweep/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_5ThreeDomainGainSweepRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('1-5');
  return <UNIT_1_5CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
