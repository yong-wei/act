import { SimulationShell } from '../_components/simulation-shell';
import { DredgerSimulation } from '../_components/simulation-loaders';

export default function DredgerSimulationPage() {
  return (
    <SimulationShell
      title="天鲸号挖泥船仿真"
      subtitle="MMG 三自由度 · 动力定位与前馈扰动补偿"
      activeHref="/simulations/dredger"
    >
      <DredgerSimulation />
    </SimulationShell>
  );
}

export const metadata = {
  title: '天鲸号挖泥船动力定位仿真 - AI-OBE船舶智控平台',
  description: '使用MMG三自由度高保真模型的挖泥船动力定位仿真，体验精确定位控制技术',
};
