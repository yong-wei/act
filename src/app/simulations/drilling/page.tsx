import { SimulationShell } from '../_components/simulation-shell';
import { DrillingSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default function DrillingSimulationPage() {
  return (
    <SimulationShell
      title="海洋石油981钻井平台仿真"
      subtitle="动力定位 DP 系统 · 多推进器解耦控制"
      activeHref="/simulations/drilling"
    >
      <DrillingSimulation />
    </SimulationShell>
  );
}
