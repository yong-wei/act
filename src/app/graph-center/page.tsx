import { AppShell } from '@/components/platform/app-shell';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import { GraphCenterClient } from '@/features/graph-center/graph-center-client';
import {
  buildGraphCenterPayload,
  type GraphCenterDomain,
} from '@/lib/data-governance/graph-center';
import type { PortraitV2DimensionId } from '@/lib/data-governance/kaq-objective-taxonomy';
import { getServerAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface GraphCenterPageProps {
  searchParams?: Promise<{
    domain?: string;
    objectiveId?: string;
    portraitDimension?: string;
    nodeId?: string;
  }>;
}

function resolveShellRole(role: string | undefined): PlatformRole {
  if (role === 'TEACHER') return 'teacher';
  if (role === 'ADMIN') return 'admin';
  if (role === 'STUDENT') return 'student';
  return 'student';
}

export default async function GraphCenterPage({ searchParams }: GraphCenterPageProps = {}) {
  const [session, params] = await Promise.all([
    getServerAuthSession(),
    searchParams,
  ]);
  const payload = buildGraphCenterPayload({
    domain: params?.domain as GraphCenterDomain | undefined,
    objectiveId: params?.objectiveId ?? null,
    portraitDimension: params?.portraitDimension as PortraitV2DimensionId | undefined,
    selectedNodeId: params?.nodeId ?? null,
  });

  return (
    <AppShell
      viewerRole={resolveShellRole(session?.user?.role)}
      title="图谱中心"
      subtitle="K/A/Q 目标、画像维度与节点关系"
      activeHref="/graph-center"
      sidebarMode="collapsible"
      className="surface-page"
    >
      <GraphCenterClient initialPayload={payload} />
    </AppShell>
  );
}
