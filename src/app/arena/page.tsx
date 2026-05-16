import { ArenaHall } from '@/features/arena/arena-hall';
import {
  ARENA_CHALLENGE_TASKS,
  buildArenaTaskStats,
  filterArenaSubmissionsForHallStats,
  toArenaStatsPublicationContext,
} from '@/features/arena/domain';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import { listArenaPublicationsForStudent } from '@/features/arena/teacher/publication-store';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ArenaPage() {
  const session = await getServerAuthSession();
  const submissions = await prismaArenaSubmissionStore.listSubmissions();
  const submissionPublicationIds = Array.from(
    new Set(submissions.map((submission) => submission.publicationId).filter((id): id is string => typeof id === 'string')),
  );
  const publicationRows = submissionPublicationIds.length > 0
    ? await prisma.arenaChallengePublication.findMany({
      where: { id: { in: submissionPublicationIds } },
      select: { id: true, deadline: true, gradingPolicy: true },
    })
    : [];
  const visibleSubmissions = filterArenaSubmissionsForHallStats(
    submissions,
    publicationRows.map(toArenaStatsPublicationContext),
    new Date(),
  );
  const taskStats = buildArenaTaskStats(visibleSubmissions, ARENA_CHALLENGE_TASKS.map((task) => task.id));
  const studentPublications = session?.user?.id && session.user.role === 'STUDENT'
    ? await listArenaPublicationsForStudent(prisma as any, { studentId: session.user.id })
    : [];

  return <ArenaHall taskStats={taskStats} studentPublications={studentPublications} />;
}
