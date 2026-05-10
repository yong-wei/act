import { notFound } from 'next/navigation';

import { ChallengeDetail } from '@/features/arena/challenge-detail';
import {
  ARENA_CHALLENGE_TASKS,
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
  getArenaMetricProfile,
} from '@/features/arena';

export function generateStaticParams() {
  return ARENA_CHALLENGE_TASKS.map((task) => ({ taskId: task.id }));
}

export default function ArenaChallengePage({ params }: { params: { taskId: string } }) {
  const task = getArenaChallengeTask(params.taskId);
  if (!task) notFound();

  const object = getArenaChallengeObject(task.objectId);
  const metricProfile = getArenaMetricProfile(task.metricProfileId);
  const leaderboardPolicy = getArenaLeaderboardPolicy(task.leaderboardPolicyId);

  if (!object || !metricProfile || !leaderboardPolicy) notFound();

  return (
    <ChallengeDetail
      task={task}
      object={object}
      metricProfile={metricProfile}
      leaderboardPolicy={leaderboardPolicy}
    />
  );
}
