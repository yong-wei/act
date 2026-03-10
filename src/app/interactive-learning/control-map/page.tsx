'use client';

import dynamic from 'next/dynamic';

const ControlMapSystem = dynamic(
  () =>
    import('@/resources/interactive-learning/control-map/control-map-system').then(
      (mod) => ({ default: mod.ControlMapSystem })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-amber-500" />
          <p className="text-sm text-slate-400">加载控制理论地图...</p>
        </div>
      </div>
    ),
  }
);

export default function ControlMapPage() {
  return <ControlMapSystem />;
}
