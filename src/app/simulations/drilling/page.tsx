import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { DrillingSimulation } from '../_components/simulation-loaders';

export const dynamic = 'force-dynamic';

export default function DrillingSimulationPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="海洋石油981钻井平台仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <DrillingSimulation />
    </div>
  );
}
