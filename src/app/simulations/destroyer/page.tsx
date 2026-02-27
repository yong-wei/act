import dynamicImport from 'next/dynamic';

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DestroyerSimulation />
    </div>
  );
}
