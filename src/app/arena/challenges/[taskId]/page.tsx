import { notFound } from 'next/navigation';

import { ChallengeDetail } from '@/features/arena/challenge-detail';
import {
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
  getArenaMetricProfile,
} from '@/features/arena/domain';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';

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
  const submissions = await prismaArenaSubmissionStore.listSubmissions({ taskId: task.id, publicationId });

  return (
    <ChallengeDetail
      task={task}
      object={object}
      metricProfile={metricProfile}
      leaderboardPolicy={leaderboardPolicy}
      submissions={submissions}
      publicationId={publicationId}
    />
  );
}
