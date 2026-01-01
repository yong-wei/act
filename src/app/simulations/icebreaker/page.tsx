import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

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
      {/* 导航栏 */}
      <header className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur-sm">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">舰队模型</span>
          <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs text-cyan-400">
            雪龙2号
          </span>
        </div>
      </header>

      {/* 仿真组件 */}
      <IcebreakerSimulation />
    </div>
  );
}

export const metadata = {
  title: '雪龙2号极地科考破冰船仿真 - AI-OBE船舶智控平台',
  description: '使用Azipod推进器和冰阻力Stick-Slip模型的破冰船仿真，体验参数摄动对控制的影响',
};
