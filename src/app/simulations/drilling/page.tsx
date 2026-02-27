import dynamicImport from 'next/dynamic';

export const dynamic = 'force-dynamic';

const DrillingSimulation = dynamicImport(
  () => import('@/resources/simulations/simulations/drilling-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-slate-300">
        正在加载海洋石油981钻井平台仿真场景...
      </div>
    ),
  },
);

export default function DrillingSimulationPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DrillingSimulation />
    </div>
  );
}
