'use client';

import dynamic from 'next/dynamic';

import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';

const ControlMapSystem = dynamic(
  () =>
    import('@/resources/interactive-learning/control-map/control-map-system').then(
      (mod) => ({ default: mod.ControlMapSystem })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center bg-platform-canvas">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-platform-border border-t-platform-action-primary" />
          <p className="text-sm text-platform-fg-secondary">加载控制理论地图...</p>
        </div>
      </div>
    ),
  }
);

export default function ControlMapPage() {
  return (
    <InteractiveLearningShell
      activeHref="/interactive-learning/control-map"
      title="控制理论地图"
      subtitle="知识区域、概念关系与核心公式"
      fillViewport
    >
      <ControlMapSystem />
    </InteractiveLearningShell>
  );
}
