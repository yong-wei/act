import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { buildArenaLeaderboard, type ArenaLeaderboardEntry } from './leaderboard';

export interface ArenaPublicationLeaderboardPolicy {
  hideFullLeaderboardBeforeDeadline?: boolean;
  [key: string]: unknown;
}

export interface ArenaPublicationLeaderboardContext {
  id: string;
  taskId: string;
  classId?: string;
  deadline?: string;
  leaderboardPolicyId: string;
  gradingPolicy?: ArenaPublicationLeaderboardPolicy;
}

export interface ArenaPublicationLeaderboardView {
  publicationId: string;
  taskId: string;
  entries: ArenaLeaderboardEntry[];
  personalStatus?: ArenaLeaderboardEntry;
  hiddenFullLeaderboard: boolean;
}

export function isArenaPublicationLate(
  publication: Pick<ArenaPublicationLeaderboardContext, 'deadline'>,
  now: Date,
): boolean {
  return typeof publication.deadline === 'string' &&
    Number.isFinite(Date.parse(publication.deadline)) &&
    now.getTime() > Date.parse(publication.deadline);
}

function belongsToPublication(
  submission: ArenaSubmissionRecord,
  publication: ArenaPublicationLeaderboardContext,
): boolean {
  if (submission.taskId !== publication.taskId) return false;
  if (submission.publicationId !== publication.id) return false;
  if (publication.classId && submission.classId !== publication.classId) return false;
  return true;
}

export function buildArenaPublicationLeaderboardView(input: {
  publication: ArenaPublicationLeaderboardContext;
  submissions: readonly ArenaSubmissionRecord[];
  viewerUserId?: string;
  now?: Date;
}): ArenaPublicationLeaderboardView {
  const now = input.now ?? new Date();
  const scoped = input.submissions.filter((submission) => belongsToPublication(submission, input.publication));
  const leaderboard = buildArenaLeaderboard(scoped, {
    taskId: input.publication.taskId,
    type: 'class',
    classId: input.publication.classId,
    leaderboardPolicyId: input.publication.leaderboardPolicyId,
  });
  const personalStatus = input.viewerUserId
    ? leaderboard.entries.find((entry) => {
      const source = scoped.find((submission) => submission.id === entry.submissionId);
      return source?.userId === input.viewerUserId;
    })
    : undefined;
  const hiddenFullLeaderboard =
    input.publication.gradingPolicy?.hideFullLeaderboardBeforeDeadline === true &&
    !isArenaPublicationLate(input.publication, now);

  return {
    publicationId: input.publication.id,
    taskId: input.publication.taskId,
    entries: hiddenFullLeaderboard ? [] : leaderboard.entries,
    personalStatus,
    hiddenFullLeaderboard,
  };
}
