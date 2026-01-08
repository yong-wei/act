import { Metadata } from 'next';
import { PresetLessonList } from '@/features/teacher/preset-lessons';

export const metadata: Metadata = {
  title: '预置教案 - 教师工作台',
  description: '浏览和使用系统预置的教学模板',
};

export default function PresetLessonsPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">预置教案</h1>
        <p className="mt-2 text-slate-400">
          浏览系统精心设计的教学模板，一键使用或克隆为自己的教案
        </p>
      </div>

      {/* 预置教案列表 */}
      <PresetLessonList />
    </main>
  );
}
