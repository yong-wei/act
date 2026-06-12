import { AppShell } from '@/components/platform/app-shell';
import { KnowledgeGraphSystem } from '@/features/knowledge/knowledge-graph-system';
import { getServerAuthSession } from '@/lib/auth';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

export const dynamic = 'force-dynamic';

function resolveKnowledgeShellRole(role: string | undefined): PlatformRole | null {
  if (role === 'STUDENT') return 'student';
  if (role === 'TEACHER') return 'teacher';
  if (role === 'ADMIN') return 'admin';
  return null;
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

  if (!shellRole) {
    return (
      <main className="surface-page">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <header className="surface-card mb-6 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">知识资源</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">知识图谱</h1>
            <p className="mt-2 text-sm text-subtle">知识关系、证据来源与学习路径入口</p>
          </header>
          <KnowledgeMapSurface />
        </div>
      </main>
    );
  }

  return (
    <AppShell
      role={shellRole}
      title="知识图谱"
      subtitle="知识关系、证据来源与学习路径入口"
      activeHref="/knowledge"
      className="surface-page"
    >
      <KnowledgeMapSurface />
    </AppShell>
  );
}
