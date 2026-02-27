import dynamic from 'next/dynamic';

const IcebreakerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/icebreaker-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-lg text-slate-400">正在加载雪龙2号破冰船仿真...</p>
          <p className="mt-2 text-sm text-slate-500">Azipod 3-DOF 模型 + 冰阻力模型初始化中</p>
        </div>
      </div>
    ),
  }
);

export default function IcebreakerSimulationPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <IcebreakerSimulation />
    </div>
  );
}

export const metadata = {
  title: '雪龙2号极地科考破冰船仿真 - AI-OBE船舶智控平台',
  description: '使用Azipod推进器和冰阻力Stick-Slip模型的破冰船仿真，体验参数摄动对控制的影响',
};
