import dynamicImport from 'next/dynamic';
import { FeaturePageNav } from '@/components/shared/feature-page-nav';

export const dynamic = 'force-dynamic';

const CruiseSimulation = dynamicImport(
  () => import('@/resources/simulations/simulations/cruise-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-slate-300">
        正在加载爱达·魔都号邮轮仿真场景...
      </div>
    ),
  },
);

export default function CruiseSimulationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="邮轮仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <CruiseSimulation />
    </div>
  );
}
