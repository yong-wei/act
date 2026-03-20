import { UnifiedTopBar } from '@/components/shared/unified-top-bar';
import { KnowledgeGraphSystem } from '@/features/knowledge/knowledge-graph-system';

export const dynamic = 'force-dynamic';

export default function KnowledgePage() {
  return (
    <main className="relative surface-page">
      <UnifiedTopBar title="知识图谱" backHref="/" backLabel="返回首页" subtitle="Knowledge Graph" />
      <KnowledgeGraphSystem />
    </main>
  );
}
