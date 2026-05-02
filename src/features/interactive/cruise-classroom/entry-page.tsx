'use client';

import { PremiumLessonEntryPage } from '@/features/interactive/shared/premium-lesson-entry-page';
import { CRUISE_COURSE_TITLE, CRUISE_PRESET_KEY } from '@/lib/cruise-course';

export function CruiseCourseEntryPage({ initialRole }: { initialRole?: string | null }) {
  return (
    <PremiumLessonEntryPage
      initialRole={initialRole}
      config={{
        title: CRUISE_COURSE_TITLE,
        description: '围绕豪华邮轮舒适度控制，把课堂创建、学生加入与自由浏览统一放入精品课堂入口。',
        presetKey: CRUISE_PRESET_KEY,
        routeSegment: 'cruise-comfort-boppps',
        overviewKicker: 'Cruise Comfort · BOPPPS',
        demoDescription: '未加入课堂时可进入学生演示模式，自行浏览全流程页面与仿真联动。',
        showMediaHub: false,
        showRuntimeSections: false,
      }}
    />
  );
}
