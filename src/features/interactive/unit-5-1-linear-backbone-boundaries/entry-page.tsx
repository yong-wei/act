'use client';

import { CourseEntryShell } from '@/features/interactive/shared/course-entry-shell';
import type { RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import {
  UNIT_5_1_COURSE_DESCRIPTION,
  UNIT_5_1_COURSE_TITLE,
  UNIT_5_1_PRESET_KEY,
  UNIT_5_1_ROUTE_SEGMENT,
} from '@/lib/unit-5-1-course';

export function UNIT_5_1CourseEntryPage({
  initialRole,
  lessonRuntime,
}: {
  initialRole?: string | null;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  return (
    <CourseEntryShell
      initialRole={initialRole}
      lessonRuntime={lessonRuntime}
      config={{
        title: UNIT_5_1_COURSE_TITLE,
        description: UNIT_5_1_COURSE_DESCRIPTION,
        presetKey: UNIT_5_1_PRESET_KEY,
        routeSegment: UNIT_5_1_ROUTE_SEGMENT,
        overviewKicker: lessonRuntime.lesson.lesson_id + ' · Course Entry',
        mediaCourseLabel: lessonRuntime.lesson.lesson_id + ' · Pre-study',
      }}
    />
  );
}
