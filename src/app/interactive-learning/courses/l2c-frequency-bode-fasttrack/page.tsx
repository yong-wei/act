import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { L2CCourseEntryPage } from '@/features/interactive/l2c-frequency-bode/entry-page';

export const dynamic = 'force-dynamic';

export default async function L2CFrequencyBodeFastTrackEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('L-2c');
  return <L2CCourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
