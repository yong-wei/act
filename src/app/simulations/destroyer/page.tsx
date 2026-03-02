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
      <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 pb-2 pt-5">
        <h1 className="text-lg font-semibold text-slate-100">军用驱逐舰战术机动仿真</h1>
      </header>
      <DestroyerSimulation />
    </div>
  );
}
