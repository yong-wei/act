'use client';

import { CourseEntryShell } from '@/features/interactive/shared/course-entry-shell';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  UNIT_2_1_COURSE_DESCRIPTION,
  UNIT_2_1_COURSE_TITLE,
  UNIT_2_1_PRESET_KEY,
  UNIT_2_1_ROUTE_SEGMENT,
} from '@/lib/unit-2-1-course';

export function UNIT_2_1CourseEntryPage({
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
        title: UNIT_2_1_COURSE_TITLE,
        description: UNIT_2_1_COURSE_DESCRIPTION,
        presetKey: UNIT_2_1_PRESET_KEY,
        routeSegment: UNIT_2_1_ROUTE_SEGMENT,
        overviewKicker: lessonRuntime.lesson.lesson_id + ' · Course Entry',
        mediaCourseLabel: lessonRuntime.lesson.lesson_id + ' · Pre-study',
      }}
    />
  );
}
