import { ArenaHall } from '@/features/arena/arena-hall';
import { ARENA_CHALLENGE_TASKS } from '@/features/arena';
import { buildArenaTaskStats } from '@/features/arena/stats';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';

export const dynamic = 'force-dynamic';

export default async function ArenaPage() {
  const submissions = await prismaArenaSubmissionStore.listSubmissions();
  const taskStats = buildArenaTaskStats(submissions, ARENA_CHALLENGE_TASKS.map((task) => task.id));

  return <ArenaHall taskStats={taskStats} />;
}
