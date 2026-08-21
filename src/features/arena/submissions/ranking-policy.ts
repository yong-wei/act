import type { ArenaSubmissionRecord } from './types';

export function isArenaSubmissionEffectiveForRanking(submission: ArenaSubmissionRecord): boolean {
  const intrinsicallyRankable = submission.evaluation.valid
    && !submission.isLate
    && submission.evaluation.score > 0
    && !submission.reusedEvaluation;
  if (!intrinsicallyRankable) return false;
  if (!submission.evidenceWriteback) return true;
  return submission.evidenceWriteback.status !== 'blocked';
}
