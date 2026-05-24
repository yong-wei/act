'use client';

import { PremiumLessonEntryPage } from '@/features/interactive/shared/premium-lesson-entry-page';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  CRUISE_COURSE_DESCRIPTION,
  CRUISE_COURSE_TITLE,
  CRUISE_PRESET_KEY,
  CRUISE_ROUTE_SEGMENT,
} from '@/lib/cruise-course';

export function CruiseStandardCourseEntryPage({
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
        title: CRUISE_COURSE_TITLE,
        description: CRUISE_COURSE_DESCRIPTION,
        presetKey: CRUISE_PRESET_KEY,
        routeSegment: CRUISE_ROUTE_SEGMENT,
        overviewKicker: 'Cruise Comfort · Standard Course',
        mediaCourseLabel: 'Cruise Comfort · Pre-study',
        demoDescription: '未加入课堂时可进入学生演示模式，自行浏览全流程页面与标准 manifest 互动。',
      }}
    />
  );
}
