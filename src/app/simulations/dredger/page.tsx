import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const DredgerSimulation = dynamic(
  () => import('@/resources/simulations/simulations/dredger-simulation').then((m) => m.DredgerSimulation),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-lg text-slate-400">正在加载天鲸号挖泥船仿真...</p>
          <p className="mt-2 text-sm text-slate-500">MMG 3-DOF 高保真模型初始化中</p>
        </div>
      </div>
    ),
  }
);

export default function DredgerSimulationPage() {
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
          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-400">
            天鲸号
          </span>
        </div>
      </header>

      {/* 仿真组件 */}
      <DredgerSimulation />
    </div>
  );
}

export const metadata = {
  title: '天鲸号挖泥船动力定位仿真 - AI-OBE船舶智控平台',
  description: '使用MMG三自由度高保真模型的挖泥船动力定位仿真，体验精确定位控制技术',
};
