'use client';

import dynamic from 'next/dynamic';

const ArgumentPrincipleSystem = dynamic(
  () =>
    import('@/components/interactive-learning/argument-principle/argument-principle-system').then(
      (mod) => ({ default: mod.ArgumentPrincipleSystem })
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
          <p className="text-sm text-slate-400">加载幅角原理可视化...</p>
        </div>
      </div>
    ),
  }
);

export default function ArgumentPrinciplePage() {
  return <ArgumentPrincipleSystem />;
}
