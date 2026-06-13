import { SimulationShell } from '../_components/simulation-shell';
import { ContainerSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default function ContainerSimulationPage() {
  return (
    <SimulationShell
      title="集装箱船仿真"
      subtitle="变质量 Nomoto · 风载荷与增益调度"
      activeHref="/simulations/container"
    >
      <ContainerSimulation />
    </SimulationShell>
  );
}
