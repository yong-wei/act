import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { LNGSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default function LNGSimulationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="LNG运输船仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <LNGSimulation />
    </div>
  );
}
