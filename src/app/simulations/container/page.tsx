import dynamicImport from 'next/dynamic';
import { FeaturePageNav } from '@/components/shared/feature-page-nav';

export const dynamic = 'force-dynamic';

const ContainerSimulation = dynamicImport(
  () => import('@/resources/simulations/simulations/container-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-slate-300">
        正在加载集装箱船仿真场景...
      </div>
    ),
  },
);

export default function ContainerSimulationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="集装箱船仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <ContainerSimulation />
    </div>
  );
}
