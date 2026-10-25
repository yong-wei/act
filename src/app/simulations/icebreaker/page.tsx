import { SimulationShell } from '../_components/simulation-shell';
import { IcebreakerSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default async function IcebreakerSimulationPage({
  searchParams,
}: {
  searchParams?: Promise<{ ticket?: string | string[] }>;
}) {
  const ticket = firstQueryValue((await searchParams)?.ticket);
  return (
    <SimulationShell
      title="破冰船吊舱与冰区实验"
      subtitle="Azipod 推进与冰阻力 · 参数摄动与鲁棒控制"
      activeHref="/simulations/icebreaker"
      localToolTemplate="ice-propulsion"
    >
      <IcebreakerSimulation ticket={ticket} />
    </SimulationShell>
  );
}

function firstQueryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export const metadata = {
  title: '雪龙2号极地科考破冰船仿真 - 智控深蓝',
  description: '使用Azipod推进器和冰阻力Stick-Slip模型的破冰船仿真，体验参数摄动对控制的影响',
};
