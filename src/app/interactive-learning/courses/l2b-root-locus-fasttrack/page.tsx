import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { L2BCourseEntryPage } from '@/features/interactive/l2b-root-locus/entry-page';

export const dynamic = 'force-dynamic';

export default async function L2BRootLocusFastTrackEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('L-2b');
  return <L2BCourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
