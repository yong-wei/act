import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { DredgerSimulation } from '../_components/simulation-loaders';

export default function DredgerSimulationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="天鲸号挖泥船仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <DredgerSimulation />
    </div>
  );
}

export const metadata = {
  title: '天鲸号挖泥船动力定位仿真 - AI-OBE船舶智控平台',
  description: '使用MMG三自由度高保真模型的挖泥船动力定位仿真，体验精确定位控制技术',
};
