import type { ArenaSubmissionRecord } from './submissions/submission-service';
import type { ArenaTaskStats } from './types';

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
