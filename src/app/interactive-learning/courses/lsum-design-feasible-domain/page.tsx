import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { LSUMCourseEntryPage } from '@/features/interactive/lsum-design-feasible-domain/entry-page';

export const dynamic = 'force-dynamic';

export default async function LSUMDesignFeasibleDomainEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('L-sum');
  return <LSUMCourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
