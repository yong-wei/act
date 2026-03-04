import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { EthicsSandbox } from '@/features/ethics/ethics-sandbox';

export const dynamic = 'force-dynamic';

export default function EthicsPage() {
  return (
    <main className="relative surface-page">
      <FeaturePageNav title="思政沙盘" backHref="/" backLabel="返回首页" floating />
      <EthicsSandbox />
    </main>
  );
}
