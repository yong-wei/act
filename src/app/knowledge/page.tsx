import { AppShell } from '@/components/platform/app-shell';
import { KnowledgeGraphSystem } from '@/features/knowledge/knowledge-graph-system';
import { getServerAuthSession } from '@/lib/auth';
import type { PlatformRoleNavigationAudience } from '@/lib/platform-role-navigation';

export const dynamic = 'force-dynamic';

function resolveKnowledgeShellRole(role: string | undefined): PlatformRoleNavigationAudience {
  if (role === 'STUDENT') return 'student';
  if (role === 'TEACHER') return 'teacher';
  if (role === 'ADMIN') return 'admin';
  return 'guest';
}

function KnowledgeMapSurface() {
  return (
    <section
      data-commercial-workspace="knowledge-data-map"
      data-commercial-workspace-zone="instrument-area"
      data-knowledge-data-map-surface="knowledge-graph"
      data-evidence-map-semantics="source-quality freshness privacy confidence status"
    >
      <KnowledgeGraphSystem />
    </section>
  );
}

export default async function KnowledgePage() {
  const session = await getServerAuthSession();
  const shellRole = resolveKnowledgeShellRole(session?.user?.role);

  return (
    <AppShell
      viewerRole={shellRole}
      title="知识图谱"
      subtitle="知识关系、证据来源与学习路径入口"
      activeHref="/knowledge"
      className="surface-page"
    >
      <KnowledgeMapSurface />
    </AppShell>
  );
}
