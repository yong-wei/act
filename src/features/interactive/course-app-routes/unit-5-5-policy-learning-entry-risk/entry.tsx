import { getServerSession } from 'next-auth';

import { UNIT_5_5CourseEntryPage } from '@/features/interactive/unit-5-5-policy-learning-entry-risk/entry-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_5MassCoordinationChainRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('5-5');
  return <UNIT_5_5CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
