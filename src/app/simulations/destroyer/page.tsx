import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { DestroyerSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default function DestroyerSimulationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="军用驱逐舰战术机动仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <DestroyerSimulation />
    </div>
  );
}
