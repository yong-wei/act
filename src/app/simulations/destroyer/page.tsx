import { SimulationShell } from '../_components/simulation-shell';
import { DestroyerSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default function DestroyerSimulationPage() {
  return (
    <SimulationShell
      title="军用驱逐舰战术机动仿真"
      subtitle="Nomoto 船舶运动模型 · 航向保持与战术机动"
      activeHref="/simulations/destroyer"
    >
      <DestroyerSimulation />
    </SimulationShell>
  );
}
