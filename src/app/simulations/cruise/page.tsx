import dynamicImport from 'next/dynamic';

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CruiseSimulation />
    </div>
  );
}
