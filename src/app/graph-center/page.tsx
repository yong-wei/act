import { AppShell } from '@/components/platform/app-shell';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import { GraphCenterClient } from '@/features/graph-center/graph-center-client';
import {
  buildGraphCenterPayload,
  type GraphCenterDomain,
} from '@/lib/data-governance/graph-center';
import { buildGraphCenterCoverageSources } from '@/lib/data-governance/graph-center-sources';
import type { PortraitV2DimensionId } from '@/lib/data-governance/kaq-objective-taxonomy';
import { getServerAuthSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface GraphCenterPageProps {
  searchParams?: Promise<{
    domain?: string;
    objectiveId?: string;
    portraitDimension?: string;
    nodeId?: string;
    learnerId?: string;
    classId?: string;
  }>;
}

function resolveShellRole(role: string | undefined): PlatformRole {
  if (role === 'TEACHER') return 'teacher';
  if (role === 'ADMIN') return 'admin';
  if (role === 'STUDENT') return 'student';
  return 'student';
}

export default async function GraphCenterPage({ searchParams }: GraphCenterPageProps) {
  const [session, params] = await Promise.all([
    getServerAuthSession(),
    searchParams,
  ]);
  const coverageSources = await buildGraphCenterCoverageSources({
    viewerRole: session?.user?.role,
    viewerUserId: session?.user?.id,
    requestedLearnerId: params?.learnerId,
    requestedClassId: params?.classId,
  });
  const sarAssociation = session?.user?.role
    ? {
        enabled: true,
        studentId: session.user.role === 'STUDENT' ? session.user.id : params?.learnerId ?? null,
        classId: session.user.role === 'STUDENT' ? null : params?.classId ?? null,
      }
    : undefined;
  const payload = buildGraphCenterPayload({
    domain: params?.domain as GraphCenterDomain | undefined,
    objectiveId: params?.objectiveId ?? null,
    portraitDimension: params?.portraitDimension as PortraitV2DimensionId | undefined,
    selectedNodeId: params?.nodeId ?? null,
    viewerRole: session?.user?.role,
    sarAssociation,
    ...coverageSources,
  });
  const rootPayload = buildGraphCenterPayload({
    domain: payload.activeDomain,
    viewerRole: session?.user?.role,
    sarAssociation,
    ...coverageSources,
  });
  const rootPayloads = {
    knowledge: payload.activeDomain === 'knowledge'
      ? rootPayload
      : buildGraphCenterPayload({ domain: 'knowledge', viewerRole: session?.user?.role, sarAssociation, ...coverageSources }),
    capability: payload.activeDomain === 'capability'
      ? rootPayload
      : buildGraphCenterPayload({ domain: 'capability', viewerRole: session?.user?.role, sarAssociation, ...coverageSources }),
    quality: payload.activeDomain === 'quality'
      ? rootPayload
      : buildGraphCenterPayload({ domain: 'quality', viewerRole: session?.user?.role, sarAssociation, ...coverageSources }),
  };

  return (
    <AppShell
      viewerRole={resolveShellRole(session?.user?.role)}
      title="图谱中心"
      subtitle="K/A/Q 目标、画像维度与节点关系"
      activeHref="/graph-center"
      sidebarMode="collapsible"
      breadcrumbs={[{ label: '首页', href: '/' }, { label: '图谱中心' }]}
      className="surface-page"
    >
      <GraphCenterClient initialPayload={payload} rootPayloads={rootPayloads} />
    </AppShell>
  );
}
