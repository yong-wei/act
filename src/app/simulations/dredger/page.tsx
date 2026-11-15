import { SimulationShell } from '../_components/simulation-shell';
import { DredgerSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default async function DredgerSimulationPage({
  searchParams,
}: {
  searchParams?: Promise<{ ticket?: string | string[] }>;
}) {
  const ticket = firstQueryValue((await searchParams)?.ticket);
  return (
    <SimulationShell
      title="天鲸号工况切换与作业定位"
      subtitle="钢桩、绞车、桥架与切削控制"
      activeHref="/simulations/dredger"
      guideHref="/supporting/guide-07-dredger.pdf"
      localToolTemplate="dredger-operation"
    >
      <DredgerSimulation ticket={ticket} />
    </SimulationShell>
  );
}

function firstQueryValue(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export const metadata = {
  title: '天鲸号工况切换与作业定位 - 智控深蓝',
  description: '通过钢桩、弹性锚缆、桥架与绞刀的实际受力，研究横移控制、土层失配和安全模式切换。',
};
