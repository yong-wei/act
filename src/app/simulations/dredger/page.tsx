import dynamic from 'next/dynamic';

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
      <DredgerSimulation />
    </div>
  );
}

export const metadata = {
  title: '天鲸号挖泥船动力定位仿真 - AI-OBE船舶智控平台',
  description: '使用MMG三自由度高保真模型的挖泥船动力定位仿真，体验精确定位控制技术',
};
