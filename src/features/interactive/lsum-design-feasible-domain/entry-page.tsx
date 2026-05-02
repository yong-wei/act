'use client';

import { PremiumLessonEntryPage } from '@/features/interactive/shared/premium-lesson-entry-page';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  LSUM_COURSE_DESCRIPTION,
  LSUM_COURSE_TITLE,
  LSUM_PRESET_KEY,
  LSUM_ROUTE_SEGMENT,
} from '@/lib/lsum-course';

export function LSUMCourseEntryPage({
  initialRole,
  lessonRuntime,
}: {
  initialRole?: string | null;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  return (
    <PremiumLessonEntryPage
      initialRole={initialRole}
      lessonRuntime={lessonRuntime}
      config={{
        title: LSUM_COURSE_TITLE,
        description: LSUM_COURSE_DESCRIPTION,
        presetKey: LSUM_PRESET_KEY,
        routeSegment: LSUM_ROUTE_SEGMENT,
        overviewKicker: lessonRuntime.lesson.lesson_id + ' · Course Entry',
        mediaCourseLabel: lessonRuntime.lesson.lesson_id + ' · Pre-study',
      }}
    />
  );
}
