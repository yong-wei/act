'use client';

import { PremiumLessonEntryPage } from '@/features/interactive/shared/premium-lesson-entry-page';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  UNIT_4_6_COURSE_DESCRIPTION,
  UNIT_4_6_COURSE_TITLE,
  UNIT_4_6_PRESET_KEY,
  UNIT_4_6_ROUTE_SEGMENT,
} from '@/lib/unit-4-6-course';

export function UNIT_4_6CourseEntryPage({
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
        title: UNIT_4_6_COURSE_TITLE,
        description: UNIT_4_6_COURSE_DESCRIPTION,
        presetKey: UNIT_4_6_PRESET_KEY,
        routeSegment: UNIT_4_6_ROUTE_SEGMENT,
        overviewKicker: lessonRuntime.lesson.lesson_id + ' · Course Entry',
        mediaCourseLabel: lessonRuntime.lesson.lesson_id + ' · Pre-study',
      }}
    />
  );
}
