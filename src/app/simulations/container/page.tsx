import { SimulationShell } from '../_components/simulation-shell';
import { ContainerSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default async function ContainerSimulationPage({
  searchParams,
}: {
  searchParams?: Promise<{ ticket?: string | string[] }>;
}) {
  const ticket = firstQueryValue((await searchParams)?.ticket);
  return (
    <SimulationShell
      title="集装箱船航速与准点实验"
      subtitle="变质量 Nomoto · 风载荷与增益调度"
      activeHref="/simulations/container"
      localToolTemplate="heading-control"
    >
      <ContainerSimulation ticket={ticket} />
    </SimulationShell>
  );
}

function firstQueryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}
