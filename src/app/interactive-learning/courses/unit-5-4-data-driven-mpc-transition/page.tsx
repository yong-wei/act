import { getServerSession } from 'next-auth';

import { UNIT_5_4CourseEntryPage } from '@/features/interactive/unit-5-4-data-driven-mpc-transition/entry-page';
import { ArenaWorkbenchSubmissionMount } from '@/features/arena/workbench/arena-workbench-submission-mount';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_5_4MassCoordinationChainRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('5-4');
  return (
    <>
      <UNIT_5_4CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />
      <ArenaWorkbenchSubmissionMount workspaceMode="predictive-control" />
    </>
  );
}
