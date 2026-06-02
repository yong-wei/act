import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { IcebreakerSimulation } from '../_components/simulation-loaders';

export default function IcebreakerSimulationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="雪龙2号破冰船仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <IcebreakerSimulation />
    </div>
  );
}

export const metadata = {
  title: '雪龙2号极地科考破冰船仿真 - AI-OBE船舶智控平台',
  description: '使用Azipod推进器和冰阻力Stick-Slip模型的破冰船仿真，体验参数摄动对控制的影响',
};
