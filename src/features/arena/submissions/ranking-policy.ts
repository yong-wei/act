import type { ArenaSubmissionRecord } from './submission-service';

export function isArenaSubmissionEffectiveForRanking(submission: ArenaSubmissionRecord): boolean {
  const evidenceWriteback = submission.evidenceWriteback;
  return submission.evaluation.valid
    && !submission.isLate
    && submission.evaluation.score > 0
    && !submission.reusedEvaluation
    && evidenceWriteback?.status === 'accepted'
    && evidenceWriteback.terminalValidationAccepted === true;
}
