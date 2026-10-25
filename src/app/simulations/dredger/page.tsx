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
      title="挖泥船工况切换实验"
      subtitle="MMG 三自由度 · 动力定位与前馈扰动补偿"
      activeHref="/simulations/dredger"
      localToolTemplate="dp-positioning"
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
  title: '天鲸号挖泥船动力定位仿真 - 智控深蓝',
  description: '使用MMG三自由度高保真模型的挖泥船动力定位仿真，体验精确定位控制技术',
};
