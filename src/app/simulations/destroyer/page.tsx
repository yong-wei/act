import dynamicImport from 'next/dynamic';
import { FeaturePageNav } from '@/components/shared/feature-page-nav';

export const dynamic = 'force-dynamic';

const DestroyerSimulation = dynamicImport(
  () => import('@/resources/simulations/simulations/destroyer-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-slate-300">
        正在加载仿真场景...
      </div>
    ),
  },
);

export default function DestroyerSimulationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="军用驱逐舰战术机动仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <DestroyerSimulation />
    </div>
  );
}
