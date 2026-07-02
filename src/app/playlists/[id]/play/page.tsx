
import { UserRole } from '@prisma/client';
import Link from 'next/link';
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
  const viewerRole = session?.user?.role;
  const viewerId = session?.user?.id;
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
    return (
      <PlaylistPlayRecovery
        message="课程流不存在或当前账号不可见。"
        actionHref={viewerId ? '/playlists' : '/login'}
        actionLabel={viewerId ? '返回课程流列表' : '去登录'}
      />
    );
  }

  const isAdmin = viewerRole === UserRole.ADMIN;
  const isAuthor = Boolean(viewerId && plan.authorId === viewerId);
  if (!plan.isPublic && !isAdmin && !isAuthor) {
    return (
      <PlaylistPlayRecovery
        message="课程流不存在或当前账号不可见。"
        actionHref={viewerId ? '/playlists' : '/login'}
        actionLabel={viewerId ? '返回课程流列表' : '去登录'}
      />
    );
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

function PlaylistPlayRecovery({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <main
      className="container mx-auto min-h-screen px-6 py-10 text-slate-100"
      data-playlist-play-recovery="unavailable"
    >
      <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-8">
        <p className="text-xs uppercase tracking-wide text-blue-300">课程流播放恢复</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">课程流不可用</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{message}</p>
        <Link
          href={actionHref}
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          {actionLabel}
        </Link>
      </section>
    </main>
  );
}
