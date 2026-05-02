'use client';

import { PremiumLessonEntryPage } from '@/features/interactive/shared/premium-lesson-entry-page';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  UNIT_3_7_COURSE_DESCRIPTION,
  UNIT_3_7_COURSE_TITLE,
  UNIT_3_7_PRESET_KEY,
  UNIT_3_7_ROUTE_SEGMENT,
} from '@/lib/unit-3-7-course';

export function UNIT_3_7CourseEntryPage({
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
        title: UNIT_3_7_COURSE_TITLE,
        description: UNIT_3_7_COURSE_DESCRIPTION,
        presetKey: UNIT_3_7_PRESET_KEY,
        routeSegment: UNIT_3_7_ROUTE_SEGMENT,
        overviewKicker: lessonRuntime.lesson.lesson_id + ' · Course Entry',
        mediaCourseLabel: lessonRuntime.lesson.lesson_id + ' · Pre-study',
      }}
    />
  );
}
