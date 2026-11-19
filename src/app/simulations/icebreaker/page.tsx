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
      title="雪龙2号吊舱与冰区控制"
      subtitle="双吊舱 · 冰接触与约束控制"
      activeHref="/simulations/icebreaker"
      guideHref="/supporting/guide-06-icebreaker.pdf"
      localToolTemplate="ice-propulsion"
    >
      <IcebreakerSimulation classroomEntry={process.env.SIMULATION_ENTRY_QUEUE === '1'} ticket={ticket} />
    </SimulationShell>
  );
}

function firstQueryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export const metadata = {
  title: '雪龙2号吊舱与冰区控制 - 智控深蓝',
  description: '通过双吊舱、六自由度冰接触与局部模型辨识，研究冰厚、强度、功率约束和航向控制。',
};
