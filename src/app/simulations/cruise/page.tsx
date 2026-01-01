import Link from 'next/link';
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
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Comfort-Oriented Control</p>
            <h1 className="text-2xl font-semibold text-white">爱达·魔都号豪华邮轮仿真</h1>
          </div>
          <Link className="text-sm text-slate-300 hover:text-white" href="/">
            返回首页
          </Link>
        </div>
      </header>
      <CruiseSimulation />
    </div>
  );
}
