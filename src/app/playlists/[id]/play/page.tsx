
import { UserRole } from '@prisma/client';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth';
import { PlaylistPlayLauncher } from '@/features/knowledge/playlist-play-launcher';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ intent?: string }>;
}

export default async function PlaylistPlayPage(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const session = await getServerAuthSession();
  const plan = await prisma.lessonPlan.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      isPublic: true,
      authorId: true,
      _count: { select: { items: true } },
    },
  });

  if (!plan) {
    notFound();
  }

  const viewerRole = session?.user?.role;
  const viewerId = session?.user?.id;
  const isAdmin = viewerRole === UserRole.ADMIN;
  const isAuthor = Boolean(viewerId && plan.authorId === viewerId);
  if (!plan.isPublic && !isAdmin && !isAuthor) {
    notFound();
  }

  const editHref = isAdmin
    ? `/admin/lesson-plans/${encodeURIComponent(plan.id)}/edit?returnTo=${encodeURIComponent('/playlists')}`
    : isAuthor && viewerRole === UserRole.TEACHER
      ? `/teacher/lesson-plans/${encodeURIComponent(plan.id)}/edit?returnTo=${encodeURIComponent('/playlists')}`
      : null;
  const canStartClass = viewerRole === UserRole.TEACHER || isAdmin;

  return (
    <PlaylistPlayLauncher
      planId={plan.id}
      title={plan.title}
      description={plan.description}
      itemCount={plan._count.items}
      intent={searchParams?.intent ?? null}
      editHref={editHref}
      canStartClass={canStartClass}
    />
  );
}
