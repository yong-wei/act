import { SimulationShell } from '../_components/simulation-shell';
import { IcebreakerSimulation } from '../_components/simulation-loaders';

export default function IcebreakerSimulationPage() {
  return (
    <SimulationShell
      title="雪龙2号破冰船仿真"
      subtitle="Azipod 推进与冰阻力 · 参数摄动与鲁棒控制"
      activeHref="/simulations/icebreaker"
    >
      <IcebreakerSimulation />
    </SimulationShell>
  );
}

export const metadata = {
  title: '雪龙2号极地科考破冰船仿真 - AI-OBE船舶智控平台',
  description: '使用Azipod推进器和冰阻力Stick-Slip模型的破冰船仿真，体验参数摄动对控制的影响',
};
