import { NextResponse } from 'next/server';

import { getArenaChallengeTask } from '@/features/arena/data/seed-challenges';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  ArenaPublicationAccessError,
  resolveAccessibleArenaPublicationForStudent,
  type ArenaResolvedSubmissionContext,
} from '@/features/arena/teacher/publication-store';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId')?.trim();
  const publicationId = searchParams.get('publicationId')?.trim() || undefined;

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  if (!getArenaChallengeTask(taskId)) {
    return NextResponse.json({ error: 'Arena task not found' }, { status: 404 });
  }

  let publicationContext: ArenaResolvedSubmissionContext | null = null;
  let viewerUserId: string | undefined;

  if (publicationId) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Only students can view Arena publication submissions' }, { status: 403 });
    }
    viewerUserId = session.user.id;
    try {
      publicationContext = await resolveAccessibleArenaPublicationForStudent(prisma as any, {
        publicationId,
        studentId: session.user.id,
        taskId,
        now: new Date(),
        allowAfterDeadline: true,
      });
    } catch (error) {
      if (error instanceof ArenaPublicationAccessError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      throw error;
    }
  }

  const submissions = await prismaArenaSubmissionStore.listSubmissions({
    taskId,
    publicationId,
    ...(publicationContext?.visibility === 'class' && publicationContext.classId ? { classId: publicationContext.classId } : {}),
  });
  const hideFullPublicationLeaderboard =
    publicationContext?.gradingPolicy.hideFullLeaderboardBeforeDeadline === true &&
    publicationContext.isLate !== true;
  const visibleSubmissions = hideFullPublicationLeaderboard && viewerUserId
    ? submissions.filter((submission) => submission.userId === viewerUserId)
    : submissions;

  return NextResponse.json({ submissions: visibleSubmissions });
}
