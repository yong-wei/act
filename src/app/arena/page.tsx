import { ArenaHall } from '@/features/arena/arena-hall';
import { ARENA_CHALLENGE_TASKS, buildArenaTaskStats } from '@/features/arena/domain';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import { listArenaPublicationsForStudent } from '@/features/arena/teacher/publication-store';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ArenaPage() {
  const session = await getServerAuthSession();
  const submissions = await prismaArenaSubmissionStore.listSubmissions();
  const taskStats = buildArenaTaskStats(submissions, ARENA_CHALLENGE_TASKS.map((task) => task.id));
  const studentPublications = session?.user?.id && session.user.role === 'STUDENT'
    ? await listArenaPublicationsForStudent(prisma as any, { studentId: session.user.id })
    : [];

  return <ArenaHall taskStats={taskStats} studentPublications={studentPublications} />;
}
