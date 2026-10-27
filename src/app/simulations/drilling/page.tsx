import { SimulationShell } from '../_components/simulation-shell';
import { DrillingSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default async function DrillingSimulationPage({
  searchParams,
}: {
  searchParams?: Promise<{ ticket?: string | string[] }>;
}) {
  const ticket = firstQueryValue((await searchParams)?.ticket);
  return (
    <SimulationShell
      title="海洋石油981动力定位"
      subtitle="动力定位 DP 系统 · 多推进器解耦控制"
      activeHref="/simulations/drilling"
      localToolTemplate="dp-positioning"
    >
      <DrillingSimulation ticket={ticket} />
    </SimulationShell>
  );
}

function firstQueryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}
