import { getServerSession } from 'next-auth';

import { UNIT_5_3CourseEntryPage } from '@/features/interactive/unit-5-3-mass-coordination-chain/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_3MassCoordinationChainRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('5-3');
  return <UNIT_5_3CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
