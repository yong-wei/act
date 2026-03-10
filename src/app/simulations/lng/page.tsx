import dynamicImport from 'next/dynamic';
import { FeaturePageNav } from '@/components/shared/feature-page-nav';

export const dynamic = 'force-dynamic';

const LNGSimulation = dynamicImport(
  () => import('@/resources/simulations/simulations/lng-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-slate-300">
        正在加载 LNG 船仿真场景...
      </div>
    ),
  },
);

export default function LNGSimulationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="LNG运输船仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <LNGSimulation />
    </div>
  );
}
