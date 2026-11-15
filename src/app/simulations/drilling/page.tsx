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
      subtitle="八推进器 · 环境载荷与动力定位"
      activeHref="/simulations/drilling"
      guideHref="/supporting/guide-05-drilling-platform.pdf"
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
