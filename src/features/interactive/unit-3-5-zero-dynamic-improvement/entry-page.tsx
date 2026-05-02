'use client';

import { PremiumLessonEntryPage } from '@/features/interactive/shared/premium-lesson-entry-page';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  UNIT_3_5_COURSE_DESCRIPTION,
  UNIT_3_5_COURSE_TITLE,
  UNIT_3_5_PRESET_KEY,
  UNIT_3_5_ROUTE_SEGMENT,
} from '@/lib/unit-3-5-course';

export function UNIT_3_5CourseEntryPage({
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
        title: UNIT_3_5_COURSE_TITLE,
        description: UNIT_3_5_COURSE_DESCRIPTION,
        presetKey: UNIT_3_5_PRESET_KEY,
        routeSegment: UNIT_3_5_ROUTE_SEGMENT,
        overviewKicker: lessonRuntime.lesson.lesson_id + ' · Course Entry',
        mediaCourseLabel: lessonRuntime.lesson.lesson_id + ' · Pre-study',
      }}
    />
  );
}
