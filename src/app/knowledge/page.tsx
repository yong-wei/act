import { AppShell } from '@/components/platform/app-shell';
import { KnowledgeGraphSystem } from '@/features/knowledge/knowledge-graph-system';
import { KnowledgeGraphWorkspace } from '@/features/knowledge/knowledge-graph-workspace';
import {
  isCandidateGraphPubliclyActivated,
  resolveCandidateGraphAccess,
} from '@/features/knowledge/candidate-graph-policy';
import { AdaptivePathJourneyControlFromRoute } from '@/features/adaptive/adaptive-path-journey-control';
import { getServerAuthSession } from '@/lib/auth';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

export const dynamic = 'force-dynamic';

function resolveKnowledgeShellRole(role: string | undefined): PlatformRole | null {
  if (role === 'STUDENT') return 'student';
  if (role === 'TEACHER') return 'teacher';
  if (role === 'ADMIN') return 'admin';
  return null;
}

function KnowledgeMapSurface({
  viewerRole,
  candidateAllowed,
  controlledVerification,
}: {
  viewerRole: PlatformRole;
  candidateAllowed: boolean;
  controlledVerification: boolean;
}) {
  return (
    <section
      className="h-[max(18rem,calc(100dvh-8rem-1px))] min-h-72 overflow-auto max-lg:h-[max(18rem,calc(100dvh-18.625rem))] lg:max-xl:h-[max(18rem,calc(100dvh-11.625rem))]"
      data-commercial-student-entry-route="/knowledge"
      data-commercial-workspace="knowledge-data-map"
      data-commercial-workspace-zone="instrument-area"
      data-knowledge-data-map-surface="knowledge-graph"
      data-evidence-map-semantics="source-quality freshness privacy confidence status"
    >
      <KnowledgeGraphWorkspace
        viewerRole={viewerRole}
        candidateAllowed={candidateAllowed}
        controlledVerification={controlledVerification}
        legacy={<KnowledgeGraphSystem viewerRole={viewerRole} />}
      />
    </section>
  );
}

export default async function KnowledgePage() {
  const session = await getServerAuthSession();
  const shellRole = resolveKnowledgeShellRole(session?.user?.role) ?? 'student';
  const candidateAccess = resolveCandidateGraphAccess(
    session?.user?.role,
    isCandidateGraphPubliclyActivated(),
  );

  return (
    <AppShell
      viewerRole={shellRole}
      title="知识图谱"
      subtitle="知识关系、证据来源与学习路径入口"
      activeHref="/knowledge"
      sidebarMode="collapsible"
      journeyControl={<AdaptivePathJourneyControlFromRoute />}
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '知识资源' },
      ]}
      className="surface-page overflow-auto"
    >
      <KnowledgeMapSurface
        viewerRole={shellRole}
        candidateAllowed={candidateAccess.allowed}
        controlledVerification={candidateAccess.controlledVerification}
      />
    </AppShell>
  );
}
