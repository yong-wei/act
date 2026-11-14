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
      title="MSC 集装箱船航速与准点"
      subtitle="变装载 · 航速调度、准点与教学燃油"
      activeHref="/simulations/container"
      guideHref="/supporting/guide-03-container.pdf"
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
