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
      title="长恒系列 LNG 运输船大惯性操纵（教学代表船）"
      subtitle="液舱晃荡 · 纵向制动与约束靠泊"
      activeHref="/simulations/lng"
      guideHref="/supporting/guide-02-lng-carrier.pdf"
      localToolTemplate="lng-berthing"
    >
      <LNGSimulation ticket={ticket} />
    </SimulationShell>
  );
}

function firstQueryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}
