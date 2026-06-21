import type { ArenaSubmissionRecord } from './submission-service';

export function isArenaSubmissionEffectiveForRanking(submission: ArenaSubmissionRecord): boolean {
  return submission.evaluation.valid && !submission.isLate && submission.evaluation.score > 0;
}
