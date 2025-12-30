'use client';

/**
 * Lesson 02: 机理建模 - 微分方程
 * 互动教学页面入口
 */

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// 动态导入主系统组件以优化首屏加载
const Lesson02System = dynamic(
  () =>
    import('@/resources/interactive-learning/lesson-02/lesson-02-system').then(
      (mod) => mod.Lesson02System
    ),
  {
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400">加载课程中...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default function Lesson02Page() {
  return <Lesson02System />;
}
