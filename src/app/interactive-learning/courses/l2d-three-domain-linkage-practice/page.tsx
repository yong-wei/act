import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { L2DCourseEntryPage } from '@/features/interactive/l2d-three-domain-linkage/entry-page';

export const dynamic = 'force-dynamic';

export default async function L2DThreeDomainLinkagePracticeEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('L-2d');
  return <L2DCourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
