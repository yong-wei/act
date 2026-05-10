import { notFound } from 'next/navigation';

import { ChallengeDetail } from '@/features/arena/challenge-detail';
import {
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
  getArenaMetricProfile,
} from '@/features/arena';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';

export const dynamic = 'force-dynamic';

export default async function ArenaChallengePage({ params }: { params: { taskId: string } }) {
  const task = getArenaChallengeTask(params.taskId);
  if (!task) notFound();

  const object = getArenaChallengeObject(task.objectId);
  const metricProfile = getArenaMetricProfile(task.metricProfileId);
  const leaderboardPolicy = getArenaLeaderboardPolicy(task.leaderboardPolicyId);

  if (!object || !metricProfile || !leaderboardPolicy) notFound();
  const submissions = await prismaArenaSubmissionStore.listSubmissions({ taskId: task.id });

  return (
    <ChallengeDetail
      task={task}
      object={object}
      metricProfile={metricProfile}
      leaderboardPolicy={leaderboardPolicy}
      submissions={submissions}
    />
  );
}
