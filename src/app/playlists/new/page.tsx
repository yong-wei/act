import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/platform/app-shell';
import { PlaylistBuilder } from '@/features/knowledge/playlist-builder';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectFromRequest } from '@/lib/auth-request-redirect';
import { getPlatformCockpitHref } from '@/lib/platform-role-navigation';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

interface NewPlaylistPageProps {
  searchParams?: Promise<{ nodeId?: string }>;
}

export default async function NewPlaylistPage({ searchParams }: NewPlaylistPageProps) {
  const params = await searchParams;
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect(await buildLoginRedirectFromRequest());
  if (!canCreatePlaylist(session.user.role)) redirect('/playlists');

  const initialNodeId = typeof params?.nodeId === 'string' ? params.nodeId : null;
  const viewerRole = resolvePlaylistBuilderRole(session.user.role);

  return (
    <AppShell
      viewerRole={viewerRole}
      activeHref="/playlists/new"
      activeNavigationHref="/interactive-learning/control-workbench"
      accountHref={getPlatformCockpitHref(session?.user?.role)}
      title="创建新课程流"
      subtitle="把知识节点编排成可播放的课堂流程。"
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '课程播放列表', href: '/playlists' },
        { label: '创建新课程流' },
      ]}
    >
      <div className="min-h-[calc(100dvh-12rem)]">
        <PlaylistBuilder initialNodeId={initialNodeId} />
      </div>
    </AppShell>
  );
}

function resolvePlaylistBuilderRole(role?: string | null): PlatformRole {
  return role?.toLowerCase() === 'admin' ? 'admin' : 'teacher';
}

function canCreatePlaylist(role?: string | null) {
  return role === UserRole.TEACHER || role === UserRole.ADMIN;
}
