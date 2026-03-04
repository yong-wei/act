import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { KnowledgeGraphSystem } from '@/features/knowledge/knowledge-graph-system';

export const dynamic = 'force-dynamic';

export default function KnowledgePage() {
  return (
    <main className="relative surface-page">
      <FeaturePageNav title="知识图谱" backHref="/" backLabel="返回首页" floating />
      <KnowledgeGraphSystem />
    </main>
  );
}
