import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_3_8CourseEntryPage } from '@/features/interactive/unit-3-8-frequency-domain-translation-judgment/entry-page';

export default async function UNIT_3_8FrequencyDomainTranslationJudgmentEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('3-8');
  return <UNIT_3_8CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
