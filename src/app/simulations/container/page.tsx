import dynamicImport from 'next/dynamic';

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ContainerSimulation />
    </div>
  );
}
