import type { ArenaSubmissionRecord } from './submissions/submission-service';
import type { ArenaTaskStats } from './types';

export interface ArenaStatsPublicationContext {
  id: string;
  deadline?: string;
  gradingPolicy?: {
    hideFullLeaderboardBeforeDeadline?: boolean;
    [key: string]: unknown;
  };
}

export function toArenaStatsPublicationContext(row: {
  id: string;
  deadline?: Date | string | null;
  gradingPolicy?: unknown;
}): ArenaStatsPublicationContext {
  const gradingPolicy = row.gradingPolicy && typeof row.gradingPolicy === 'object' && !Array.isArray(row.gradingPolicy)
    ? row.gradingPolicy as ArenaStatsPublicationContext['gradingPolicy']
    : {};

  return {
    id: row.id,
    deadline: row.deadline instanceof Date ? row.deadline.toISOString() : row.deadline ?? undefined,
    gradingPolicy,
  };
}

export function isArenaPublicationHiddenFromHallStats(
  publication: ArenaStatsPublicationContext,
  now: Date,
): boolean {
  if (publication.gradingPolicy?.hideFullLeaderboardBeforeDeadline !== true) return false;
  if (typeof publication.deadline !== 'string') return false;
  const deadlineTime = Date.parse(publication.deadline);
  if (!Number.isFinite(deadlineTime)) return false;
  return now.getTime() <= deadlineTime;
}

export function filterArenaSubmissionsForHiddenPublicationPolicy(
  submissions: readonly ArenaSubmissionRecord[],
  publications: readonly ArenaStatsPublicationContext[],
  now: Date = new Date(),
): ArenaSubmissionRecord[] {
  const publicationById = new Map(publications.map((publication) => [publication.id, publication]));
  return submissions.filter((submission) => {
    if (!submission.publicationId) return true;
    const publication = publicationById.get(submission.publicationId);
    if (!publication) return true;
    return !isArenaPublicationHiddenFromHallStats(publication, now);
  });
}

export function filterArenaSubmissionsForHallStats(
  submissions: readonly ArenaSubmissionRecord[],
  publications: readonly ArenaStatsPublicationContext[],
  now: Date = new Date(),
): ArenaSubmissionRecord[] {
  return filterArenaSubmissionsForHiddenPublicationPolicy(submissions, publications, now);
}

export function buildArenaTaskStats(
  submissions: readonly ArenaSubmissionRecord[],
  taskIds: readonly string[],
): Record<string, ArenaTaskStats> {
  const stats: Record<string, ArenaTaskStats> = Object.fromEntries(
    taskIds.map((taskId) => [
      taskId,
      {
        participantCount: 0,
        submissionCount: 0,
        topScore: null,
      },
    ]),
  ) as Record<string, ArenaTaskStats>;

  for (const taskId of taskIds) {
    const taskSubmissions = submissions.filter((submission) => submission.taskId === taskId);
    const participantKeys = new Set(taskSubmissions.map((submission) => submission.userId ?? submission.studentLabel));
    const validScores = taskSubmissions
      .filter((submission) => submission.evaluation.valid)
      .map((submission) => submission.evaluation.score);

    stats[taskId] = {
      participantCount: participantKeys.size,
      submissionCount: taskSubmissions.length,
      topScore: validScores.length > 0 ? Math.max(...validScores) : null,
    };
  }

  return stats;
}
