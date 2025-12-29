'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const PhysicsModelingSystem = dynamic(
  () =>
    import('@/components/interactive-learning/physics-modeling/physics-modeling-system').then(
      (mod) => mod.PhysicsModelingSystem
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-slate-400">加载物理建模工坊...</p>
        </div>
      </div>
    ),
  }
);

export default function PhysicsModelingPage() {
  return <PhysicsModelingSystem />;
}
