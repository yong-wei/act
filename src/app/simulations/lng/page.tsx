import { SimulationShell } from '../_components/simulation-shell';
import { LNGSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default async function LNGSimulationPage({
  searchParams,
}: {
  searchParams?: Promise<{ ticket?: string | string[] }>;
}) {
  const ticket = firstQueryValue((await searchParams)?.ticket);
  return (
    <SimulationShell
      title="长恒号 LNG 大惯性操纵"
      subtitle="大型船舶操纵仿真 · 大惯性系统控制"
      activeHref="/simulations/lng"
      localToolTemplate="heading-control"
    >
      <LNGSimulation ticket={ticket} />
    </SimulationShell>
  );
}

function firstQueryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}
