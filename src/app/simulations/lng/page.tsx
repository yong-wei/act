import { SimulationShell } from '../_components/simulation-shell';
import { LNGSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default function LNGSimulationPage() {
  return (
    <SimulationShell
      title="LNG运输船仿真"
      subtitle="大型船舶操纵仿真 · 大惯性系统控制"
      activeHref="/simulations/lng"
      localToolTemplate="heading-control"
    >
      <LNGSimulation />
    </SimulationShell>
  );
}
