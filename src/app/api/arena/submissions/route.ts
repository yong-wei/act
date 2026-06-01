import { NextResponse } from 'next/server';

import { getArenaChallengeTask } from '@/features/arena/data/seed-challenges';
import {
  filterArenaSubmissionsForHiddenPublicationPolicy,
  toArenaStatsPublicationContext,
} from '@/features/arena/stats';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  ArenaPublicationAccessError,
  resolveAccessibleArenaPublicationForStudent,
  type ArenaResolvedSubmissionContext,
} from '@/features/arena/teacher/publication-store';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
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

  const session = await getServerAuthSession();
  const viewerUserId = session?.user?.id;
  let publicationContext: ArenaResolvedSubmissionContext | null = null;

  if (publicationId) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Only students can view Arena publication submissions' }, { status: 403 });
    }
    try {
      publicationContext = await resolveAccessibleArenaPublicationForStudent(prisma as any, {
        publicationId,
        studentId: session.user.id,
        taskId,
        now: new Date(),
        allowAfterDeadline: true,
      });
    } catch (error) {
      rethrowIfNextDynamicError(error);
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
  const submissionPublicationIds = publicationId
    ? []
    : Array.from(
      new Set(
        submissions
          .map((submission) => submission.publicationId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    );
  const publicationRows = submissionPublicationIds.length > 0
    ? await prisma.arenaChallengePublication.findMany({
      where: { id: { in: submissionPublicationIds } },
      select: { id: true, deadline: true, gradingPolicy: true },
    })
    : [];
  const hideFullPublicationLeaderboard =
    publicationContext?.gradingPolicy.hideFullLeaderboardBeforeDeadline === true &&
    publicationContext.isLate !== true;
  const taskVisibleSubmissions = publicationId
    ? submissions
    : filterArenaSubmissionsForHiddenPublicationPolicy(
      submissions,
      publicationRows.map(toArenaStatsPublicationContext),
      new Date(),
    );
  const visibleSubmissions = hideFullPublicationLeaderboard && viewerUserId
    ? taskVisibleSubmissions.filter((submission) => submission.userId === viewerUserId)
    : taskVisibleSubmissions;

  return NextResponse.json({
    submissions: visibleSubmissions,
    viewerUserId: session?.user?.id,
  });
}
