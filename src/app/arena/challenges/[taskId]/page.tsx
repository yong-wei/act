import { notFound } from 'next/navigation';

import { ChallengeDetail } from '@/features/arena/challenge-detail';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterArenaSubmissionsForHiddenPublicationPolicy,
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
  getArenaMetricProfile,
  toArenaStatsPublicationContext,
} from '@/features/arena/domain';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  ArenaPublicationAccessError,
  resolveAccessibleArenaPublicationForStudent,
  type ArenaResolvedSubmissionContext,
} from '@/features/arena/teacher/publication-store';

export const dynamic = 'force-dynamic';

export default async function ArenaChallengePage({
  params,
  searchParams,
}: {
  params: { taskId: string };
  searchParams?: { publicationId?: string };
}) {
  const task = getArenaChallengeTask(params.taskId);
  if (!task) notFound();

  const object = getArenaChallengeObject(task.objectId);
  const metricProfile = getArenaMetricProfile(task.metricProfileId);
  const leaderboardPolicy = getArenaLeaderboardPolicy(task.leaderboardPolicyId);

  if (!object || !metricProfile || !leaderboardPolicy) notFound();
  const publicationId = typeof searchParams?.publicationId === 'string' && searchParams.publicationId.trim().length > 0
    ? searchParams.publicationId
    : undefined;
  let publicationContext: ArenaResolvedSubmissionContext | null = null;
  let viewerUserId: string | undefined;
  if (publicationId) {
    const session = await getServerAuthSession();
    if (!session?.user?.id || session.user.role !== 'STUDENT') {
      notFound();
    }
    viewerUserId = session.user.id;
    try {
      publicationContext = await resolveAccessibleArenaPublicationForStudent(prisma as any, {
        publicationId,
        studentId: session.user.id,
        taskId: task.id,
        now: new Date(),
        allowAfterDeadline: true,
      });
    } catch (error) {
      if (error instanceof ArenaPublicationAccessError) {
        notFound();
      }
      throw error;
    }
  }

  const submissions = await prismaArenaSubmissionStore.listSubmissions({
    taskId: task.id,
    publicationId,
    ...(publicationContext?.classId ? { classId: publicationContext.classId } : {}),
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

  return (
    <ChallengeDetail
      task={task}
      object={object}
      metricProfile={metricProfile}
      leaderboardPolicy={leaderboardPolicy}
      submissions={visibleSubmissions}
      publicationId={publicationId}
    />
  );
}
