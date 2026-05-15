'use client';

/**
 * Control Odyssey 游戏独立入口页面
 */

import dynamic from 'next/dynamic';
import { ArenaWorkbenchSubmissionMount } from '@/features/arena/workbench/arena-workbench-submission-mount';

const ControlOdysseyGame = dynamic(
  () => import('@/resources/interactive-learning/control-odyssey').then(mod => mod.ControlOdysseyGame),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>初始化控制系统...</p>
        </div>
      </div>
    ),
  }
);

export default function ControlOdysseyPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex min-h-screen items-center justify-center">
        <ControlOdysseyGame
          initialLevelId="level-1"
          showEducation={true}
        />
      </div>
      <ArenaWorkbenchSubmissionMount workspaceMode="control-odyssey" />
    </div>
  );
}
